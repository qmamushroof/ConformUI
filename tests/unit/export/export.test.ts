import { ContractExportV1Schema, type Finding, ReportExportV1Schema, type Run } from '@kernel';
import { describe, expect, it } from 'vitest';
import {
  contractJson,
  contractMarkdown,
  fileName,
  fixPrompt,
  reportJson,
  reportMarkdown,
} from '../../../src/features/export';
import {
  capture,
  contract,
  domSnapshot,
  evidence,
  finding,
  measurement,
  project,
  requirement,
  requirementResult,
  run,
  traceStep,
} from '../../helpers/samples';

const EM_DASH = String.fromCharCode(0x2014);
const JA = String.fromCharCode(0x65e5, 0x672c);
const E_ACUTE = String.fromCharCode(0xe9);

const fail = (id: string, over: Partial<Finding> = {}): Finding =>
  finding({ id: `run-1:${id}:desktop`, requirementId: id, statement: `Statement ${id}`, ...over });

const scenario = () => {
  const findings: Finding[] = [
    fail('R-05', { severity: 'minor', suggestedFix: 'Fix five' }),
    fail('R-02', { severity: 'critical', label: 'inferred', origin: 'rule' }),
    fail('R-03', {
      severity: 'critical',
      status: 'needs-review',
      engine: 'on-device',
      evidence: evidence({ measurements: [] }),
    }),
    fail('R-01', { severity: 'critical' }),
    fail('R-04', { severity: 'major', viewport: 'mobile', id: 'run-1:R-04:mobile' }),
  ];
  const r: Run = run({
    results: [
      ...findings.map((f) =>
        requirementResult({
          requirementId: f.requirementId,
          viewport: f.viewport,
          status: f.status,
          finding: f,
          engine: f.engine,
        }),
      ),
      requirementResult({ requirementId: 'R-09', status: 'pass', finding: undefined }),
      requirementResult({
        requirementId: 'R-10',
        status: 'not-checked',
        reason: 'offline',
        hint: 'Go online',
        finding: undefined,
      }),
    ],
  });
  const c = contract({
    requirements: ['R-01', 'R-02', 'R-03', 'R-04', 'R-05', 'R-09', 'R-10'].map((id) =>
      requirement({ id, statement: `Requirement text ${id}`, viewport: id === 'R-04' ? 'mobile' : 'desktop' }),
    ),
  });
  return { findings, run: r, contract: c, project: project({ name: 'My Site' }) };
};

describe('export fixPrompt', () => {
  it('SPEC-EXP-01: two calls are byte-identical and independent of input array order', () => {
    const s = scenario();
    const a = fixPrompt(s);
    expect(fixPrompt(s)).toBe(a);
    expect(fixPrompt({ ...s, findings: [...s.findings].reverse() })).toBe(a);
  });

  it('SPEC-EXP-01, SPEC-RUN-08: orders by severity, fail before needs-review, explicit before inferred, inferred listed last', () => {
    const p = fixPrompt(scenario());
    const order = ['R-01', 'R-03', 'R-04', 'R-05', 'R-02'].map((id) => p.indexOf(`${id} Statement`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(p).toContain('(inferred)');
    expect(p).toMatch(/^1\. \[Critical/m);
  });

  it('SPEC-EXP-01, S20: needs-review findings are marked verify first and failing ones are not', () => {
    const p = fixPrompt(scenario());
    const line = (id: string) => p.split('\n').find((l) => l.includes(`${id} Statement`)) ?? '';
    expect(line('R-03')).toMatch(/verify first/i);
    expect(line('R-01')).not.toMatch(/verify first/i);
  });

  it('SPEC-EXP-01: passing and not-checked requirements never appear', () => {
    const p = fixPrompt(scenario());
    expect(p).not.toContain('R-09');
    expect(p).not.toContain('R-10');
    expect(p).not.toContain('Requirement text');
  });

  it('SPEC-EXP-01, PRD-P-02: numbers and sources come from measurements only', () => {
    const p = fixPrompt(scenario());
    expect(p).toContain('132 px (DOM snapshot) vs 220 px (design image)');
    expect(p).toContain('-40');
    expect(p).toContain('Set the CTA width to 220 px');
    expect(p).toContain('Done when: CTA width within 8% of 220 px');
    expect(p).toContain('Element: #cta');
  });

  it('SPEC-EXP-01: header names project, contract version, run date, viewports with widths, and closing re-verify line', () => {
    const p = fixPrompt(scenario());
    expect(p).toContain('Page: "My Site"');
    expect(p).toContain('Desktop 1440 px');
    expect(p).toContain('Mobile 390 px');
    expect(p).toContain('Contract version 1, run 2023-11-14');
    expect(p).toContain('Fix ONLY the items below.');
    expect(p).toContain('take new screenshots and DOM snapshots');
  });

  it('SPEC-EXP-01: includes the page URL without query or hash when a capture knows it', () => {
    const s = scenario();
    const withUrl = {
      ...s,
      project: project({
        name: 'My Site',
        captures: [
          capture({ dom: domSnapshot({ page: { url: 'https://example.test/a?token=SECRET#x', title: 't' } }) }),
        ],
      }),
    };
    const p = fixPrompt(withUrl);
    expect(p).toContain('URL: https://example.test/a');
    expect(p).not.toContain('SECRET');
    expect(fixPrompt({ ...s, project: project({ name: 'My Site', captures: [] }) })).not.toContain('URL:');
  });

  it('SPEC-EXP-01: empty findings yields a prompt with nothing to fix and no numbered items', () => {
    const p = fixPrompt({ ...scenario(), findings: [] });
    expect(p).toContain('Nothing to fix');
    expect(p).not.toMatch(/^1\./m);
  });

  it('SPEC-EXP-01, PRD-F-09.2: scope narrows by finding ids and viewport', () => {
    const s = scenario();
    const byId = fixPrompt({ ...s, scope: { findingIds: ['run-1:R-01:desktop'] } });
    expect(byId).toContain('R-01 Statement');
    expect(byId).not.toContain('R-05 Statement');
    const byVp = fixPrompt({ ...s, scope: { viewport: 'mobile' } });
    expect(byVp).toContain('R-04 Statement');
    expect(byVp).not.toContain('R-01 Statement');
  });

  it('SPEC-EXP-01: plain text only, newlines collapse, html is neutralised, long text is capped, unicode kept', () => {
    const s = scenario();
    const nasty = fail('R-06', {
      statement: `Line1\nLine2 <script>alert(1)</script> caf${E_ACUTE} ${JA} ${'x'.repeat(5000)}`,
      suggestedFix: 'Use `code` | pipe',
    });
    const p = fixPrompt({ ...s, findings: [nasty] });
    expect(p).not.toContain('<script>');
    expect(p).toContain(`caf${E_ACUTE} ${JA}`);
    expect(p).toContain('Line1 Line2');
    expect(p.length).toBeLessThan(3000);
  });

  it('SPEC-EXP-01: no em dash and no local paths or blob ids leak', () => {
    const p = fixPrompt(scenario());
    expect(p).not.toContain(EM_DASH);
    expect(p).not.toContain('blob-1');
    expect(p).not.toMatch(/[A-Z]:\\/);
  });
});

describe('export contract', () => {
  it('SPEC-EXP-02: contractJson round-trips through the kernel schema and is deterministic', () => {
    const s = scenario();
    const j = contractJson(s.contract, s.project);
    expect(ContractExportV1Schema.parse(JSON.parse(JSON.stringify(j)))).toEqual(j);
    expect(JSON.stringify(contractJson(s.contract, s.project))).toBe(JSON.stringify(j));
    expect(j.schema).toBe('conformui.contract');
    expect(j.exportedAt).toBe(new Date(s.contract.createdAt).toISOString());
    expect(j.project.name).toBe('My Site');
    expect(j.project.viewports).toEqual(['desktop', 'mobile']);
  });

  it('SPEC-EXP-02: engine is null when absent and no images or snapshot text are exported', () => {
    const j = contractJson(contract({ requirements: [requirement({ engine: undefined })] }), project());
    expect(j.contract.requirements[0]?.engine).toBeNull();
    const text = JSON.stringify(j);
    expect(text).not.toContain('blob-1');
    expect(text).not.toContain('Sample landing page ');
  });

  it('SPEC-EXP-02: empty contract is valid', () => {
    const j = contractJson(contract({ requirements: [] }), project());
    expect(j.contract.requirements).toEqual([]);
  });

  it('SPEC-EXP-02: contractMarkdown is deterministic, escapes markup and keeps unicode', () => {
    const p = project({ name: 'My Site' });
    const c = contract({ requirements: [requirement({ statement: `A | B <b>bold</b> *x* ${JA}` })] });
    const md = contractMarkdown(c, p);
    expect(contractMarkdown(c, p)).toBe(md);
    expect(md).toContain('# Contract: My Site');
    expect(md).toContain('R-01');
    expect(md).not.toContain('<b>');
    expect(md).toContain('\\|');
    expect(md).toContain(JA);
    expect(md).not.toContain(EM_DASH);
  });
});

describe('export report', () => {
  it('SPEC-EXP-03: reportJson round-trips through zod, is byte-identical on repeat, summary counts match', () => {
    const s = scenario();
    const j = reportJson(s);
    expect(ReportExportV1Schema.parse(JSON.parse(JSON.stringify(j)))).toEqual(j);
    expect(JSON.stringify(reportJson(s))).toBe(JSON.stringify(j));
    expect(j.run.summary).toEqual({ pass: 1, fail: 4, review: 1, notChecked: 1 });
    expect(j.run.viewports).toEqual(['desktop', 'mobile']);
    expect(j.contract).toEqual({ id: 'contract-1', version: 1 });
    expect(j.run.precomputed).toBe(false);
    expect(j.results).toHaveLength(7);
  });

  it('SPEC-EXP-03: crops stay as rects and no blob ids are exported', () => {
    const j = reportJson(scenario());
    expect(JSON.stringify(j)).not.toContain('blob');
    const withFinding = j.results.find((r) => r.finding);
    expect(withFinding?.finding?.evidence.designCrop).toEqual({ x: 0, y: 0, w: 100, h: 50 });
  });

  it('SPEC-EXP-05, PRD-M-03: every measurement number carries a source tag and every finding an engine', () => {
    const j = reportJson(scenario());
    let walked = 0;
    for (const r of j.results) {
      expect(r.engine).toBeTruthy();
      if (r.finding) expect(r.finding.engine).toBeTruthy();
      for (const m of r.finding?.evidence.measurements ?? []) {
        walked++;
        expect(m.source.observed).toBeTruthy();
        if (m.design !== undefined) expect(m.source.design).toBeTruthy();
      }
    }
    expect(walked).toBeGreaterThan(0);
  });

  it('SPEC-EXP-05: a design number without a design source is refused before download', () => {
    const s = scenario();
    const bad = fail('R-07', {
      evidence: evidence({ measurements: [measurement({ source: { observed: 'dom-snapshot' } })] }),
    });
    const r = run({ results: [requirementResult({ requirementId: 'R-07', finding: bad })] });
    expect(() => reportJson({ ...s, run: r, findings: [bad] })).toThrow();
  });

  it('SPEC-EXP-05: schema-invalid input throws instead of exporting', () => {
    const bad = run({ trace: [traceStep({ durationMs: -1 })] });
    expect(() => reportJson({ ...scenario(), run: bad })).toThrow();
  });

  it('SPEC-EXP-03: empty findings and empty results export cleanly', () => {
    const s = scenario();
    const empty = run({ results: [] });
    const j = reportJson({ ...s, run: empty, findings: [] });
    expect(j.run.summary).toEqual({ pass: 0, fail: 0, review: 0, notChecked: 0 });
    expect(reportMarkdown({ ...s, run: empty, findings: [] })).toContain('No findings');
  });

  it('SPEC-EXP-04: markdown has title, summary, trace table, findings grouped by severity with engine and source tags, then passing and not checked', () => {
    const s = scenario();
    const md = reportMarkdown(s);
    expect(reportMarkdown(s)).toBe(md);
    expect(md).toMatch(/^# Report: My Site/);
    expect(md).toContain('1 passing, 4 failing, 1 needs review, 1 not checked');
    expect(md).toContain('| Step | Engine | Duration | Bytes sent |');
    expect(md).toContain('extract-contract');
    const idx = ['## Critical', '## Major', '## Minor', '## Passing', '## Not checked'].map((h) => md.indexOf(h));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(md).toContain('Engine: Measured');
    expect(md).toContain('132 px (DOM snapshot) vs 220 px (design image)');
    expect(md).toContain('Requirement text R-09');
    expect(md).toContain('R-10');
    expect(md).toContain('offline');
    expect(md).toContain('Go online');
  });

  it('SPEC-EXP-04, S20: needs-review findings are labelled verify first in the report', () => {
    expect(reportMarkdown(scenario())).toMatch(/R-03[^\n]*verify first/i);
  });

  it('SPEC-EXP-04: pre-computed runs carry the sample banner and live runs do not', () => {
    const s = scenario();
    expect(reportMarkdown({ ...s, run: { ...s.run, precomputed: true } })).toContain('Sample results (pre-computed)');
    expect(reportMarkdown(s)).not.toContain('Sample results (pre-computed)');
    expect(reportJson({ ...s, run: { ...s.run, precomputed: true } }).run.precomputed).toBe(true);
  });

  it('SPEC-EXP-04: markdown escapes table pipes and html, caps long text, keeps unicode, no em dash', () => {
    const s = scenario();
    const nasty = fail('R-01', { statement: `a|b <img src=x> ${JA} ${'y'.repeat(5000)}`, severity: 'critical' });
    const r = run({
      results: [requirementResult({ requirementId: 'R-01', finding: nasty })],
      trace: [traceStep({ step: 'x|y' })],
    });
    const md = reportMarkdown({ ...s, run: r, findings: [nasty] });
    expect(md).not.toContain('<img');
    expect(md).toContain('x\\|y');
    expect(md).toContain(JA);
    expect(md.length).toBeLessThan(6000);
    expect(md).not.toContain(EM_DASH);
  });
});

describe('export fileName', () => {
  const at = Date.UTC(2026, 10, 25, 9, 5);

  it('SPEC-EXP-01: follows conformui-<slug>-<kind>-YYYYMMDD-HHmm.<ext>', () => {
    expect(fileName('report', project({ name: 'My Site' }), 'md', at)).toBe(
      'conformui-my-site-report-20261125-0905.md',
    );
    expect(fileName('contract', project({ name: 'My Site' }), 'json', at)).toBe(
      'conformui-my-site-contract-20261125-0905.json',
    );
  });

  it('SPEC-EXP-01: slug strips unsafe characters, separators and paths, and has a fallback and a length cap', () => {
    expect(fileName('report', project({ name: `../Caf${E_ACUTE} / "Site"?*` }), 'md', at)).toBe(
      'conformui-caf-site-report-20261125-0905.md',
    );
    expect(fileName('report', project({ name: JA }), 'md', at)).toBe('conformui-project-report-20261125-0905.md');
    expect(fileName('report', project({ name: 'a'.repeat(200) }), 'md', at).length).toBeLessThan(80);
  });
});
