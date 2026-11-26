import type { Finding, Run } from '@kernel';
import { describe, expect, it } from 'vitest';
import { createRunService } from '../../../src/features/run';
import { resultFromOutcome } from '../../../src/features/run/findings';
import type { ResultOutcome } from '../../../src/features/run/types';
import { domSnapshot, finding, requirement, requirementResult, run as sampleRun } from '../../helpers/samples';
import { cta, H, R, status, W, world } from './harness';

// SPEC-RUN-05..08, PRD-P-01, PRD-P-03, PRD-P-04, PRD-P-07, PRD-M-03, PRD-M-10.

const outcome = (over: Partial<ResultOutcome> = {}): ResultOutcome => ({
  kind: 'result',
  status: 'fail',
  confidence: 'high',
  severity: 'major',
  statement: 'Primary CTA is 60 px wide vs 100 px in the design (−40.0%), measured from DOM snapshot.',
  fix: 'Make `#cta` 100 px wide.',
  facts: { measurements: [], designCrop: R, captureCrop: R },
  ...over,
});

const build = (o: ResultOutcome, req = requirement()) => resultFromOutcome({ runId: 'run-1', req, outcome: o });

describe('severity and status (SPEC-RUN-05, SPEC-RUN-06)', () => {
  it('SPEC-RUN-06, PRD-M-10: an Inferred item is never above Minor, and its statement is worded "Expected … (inferred)"', () => {
    const req = requirement({
      id: 'I-M-01',
      label: 'inferred',
      viewport: 'mobile',
      statement: 'The mobile page fits the screen',
    });
    for (const sev of ['critical', 'major', 'minor'] as const) {
      const f = build(outcome({ severity: sev }), req).finding;
      expect(f?.severity, sev).toBe('minor');
      expect(f?.label).toBe('inferred');
      expect(f?.statement).toMatch(/^Expected .*\(inferred\)/);
    }
  });

  it('SPEC-RUN-06: a statement that already starts with Expected and ends with (inferred) is not doubled', () => {
    const req = requirement({ label: 'inferred', statement: 'Expected the primary action to stay visible (inferred)' });
    const s = build(outcome(), req).finding?.statement ?? '';
    expect(s.match(/\(inferred\)/g)).toHaveLength(1);
    expect(s.startsWith('Expected the primary action to stay visible (inferred)')).toBe(true);
  });

  it('SPEC-RUN-05: an Explicit item keeps the severity the handler gave', () => {
    expect(build(outcome({ severity: 'critical' })).finding?.severity).toBe('critical');
    expect(build(outcome({ severity: 'minor' })).finding?.severity).toBe('minor');
  });

  it('SPEC-RUN-06, PRD-P-04: Low confidence is needs-review, for a fail and for a pass', () => {
    expect(build(outcome({ confidence: 'low' })).status).toBe('needs-review');
    const lowPass = build(outcome({ status: 'pass', confidence: 'low', facts: { measurements: [] } }));
    expect(lowPass.status).toBe('needs-review');
    expect(lowPass.finding?.status).toBe('needs-review');
  });

  it('SPEC-RUN-07: a pass has no Finding; a fail and a needs-review each have one with the id scheme and engine', () => {
    expect(build(outcome({ status: 'pass', facts: { measurements: [] } })).finding).toBeUndefined();
    const f = build(outcome());
    expect(f.finding).toMatchObject({
      id: 'run-1:R-01:desktop',
      status: 'fail',
      engine: 'measured',
      requirementId: 'R-01',
    });
    expect(build(outcome({ status: 'needs-review' })).finding?.status).toBe('needs-review');
  });

  it('SPEC-RUN-07: not-checked has no Finding and keeps its reason and hint', () => {
    const r = build(outcome({ status: 'not-checked', reason: 'misaligned', hint: 'x' }));
    expect(r).toMatchObject({ status: 'not-checked', reason: 'misaligned', hint: 'x' });
    expect(r.finding).toBeUndefined();
  });

  it('SPEC-RUN-07, PRD-P-07: a fail without any crop becomes needs-review "Evidence could not be produced"', () => {
    const r = build(outcome({ facts: { measurements: [] } }));
    expect(r.status).toBe('needs-review');
    expect(r.finding?.status).toBe('needs-review');
    expect(r.finding?.statement).toContain('Evidence could not be produced');
  });

  it('SPEC-RUN-07: one crop is enough evidence', () => {
    expect(build(outcome({ facts: { measurements: [], captureCrop: R } })).status).toBe('fail');
    expect(build(outcome({ facts: { measurements: [], designCrop: R } })).status).toBe('fail');
  });

  it('SPEC-RUN-07: the Finding carries the contract condition, the engine of the judge and the origin', () => {
    const r = resultFromOutcome({
      runId: 'r',
      req: requirement(),
      outcome: outcome(),
      engine: 'cloud',
      origin: 'precomputed',
    });
    expect(r.finding).toMatchObject({ engine: 'cloud', origin: 'precomputed', condition: requirement().condition });
    expect(r.origin).toBe('precomputed');
  });

  it('SPEC-RUN-07: long free text is capped', () => {
    const long = 'x'.repeat(2000);
    const f = build(outcome({ statement: long, fix: long })).finding;
    expect(f?.statement.length).toBeLessThanOrEqual(400);
    expect(f?.suggestedFix.length).toBeLessThanOrEqual(400);
  });
});

describe('AI text and the number guard (SPEC-RUN-07, SPEC-KERNEL-08, S23, PRD-M-03)', () => {
  const judgedWorld = (out: unknown) =>
    world({
      reqs: [
        requirement({
          id: 'R-02',
          category: 'colour',
          checkType: 'judged',
          statement: 'The button uses the design colour',
          condition: 'Same colour as the design',
          check: { kind: 'judged', question: 'Same colour?' },
          region: { rect: R, source: 'sample' },
          origin: 'sample',
        }),
      ],
      fake: { outputs: { judge: out } },
    });
  const fail = (explanation: string, suggestedFix: string) => ({
    verdict: 'fail',
    confidence: 'high',
    explanation,
    suggestedFix,
  });

  it('SPEC-RUN-07, PRD-M-03: an invented number in the AI fix falls back to the deterministic template', async () => {
    const w = await judgedWorld(fail('The colour is wrong.', 'Set the width to 987 px.'));
    const run = await w.service.start('project-1', w.ctxFor(), w.on);
    const f = run.results[0]?.finding;
    expect(f?.suggestedFix).not.toContain('987');
    expect(f?.suggestedFix.length).toBeGreaterThan(0);
  });

  it('SPEC-RUN-07, PRD-M-03: an invented number in the AI explanation is left out of the statement', async () => {
    const w = await judgedWorld(fail('It is off by 777 px.', 'Use the design colour.'));
    const run = await w.service.start('project-1', w.ctxFor(), w.on);
    const f = run.results[0]?.finding;
    expect(f?.statement).not.toContain('777');
    expect(f?.suggestedFix).toBe('Use the design colour.');
    expect(run.trace.some((s) => /numberGuardTripped/.test(s.note ?? ''))).toBe(true);
  });

  it('SPEC-RUN-07: numbers that appear in the request (the contract, the measurements) are allowed', async () => {
    const w = await judgedWorld(fail('The region is 100 px wide in both.', 'Keep the 50 px height.'));
    const run = await w.service.start('project-1', w.ctxFor(), w.on);
    const f = run.results[0]?.finding;
    expect(f?.statement).toContain('100 px');
    expect(f?.suggestedFix).toBe('Keep the 50 px height.');
    expect(run.trace.some((s) => /numberGuardTripped/.test(s.note ?? ''))).toBe(false);
  });

  it('SPEC-SEC-07: the AI cannot change a Measured status or severity (only Judged items take AI answers)', async () => {
    const w = await world({
      fake: { outputs: { judge: { verdict: 'pass', confidence: 'high', explanation: 'ok', suggestedFix: 'none' } } },
    });
    const run = await w.service.start('project-1', w.ctxFor(), w.on);
    const r1 = run.results.find((r) => r.requirementId === 'R-01');
    expect(r1).toMatchObject({ status: 'fail', engine: 'measured' });
    expect(r1?.finding?.severity).toBe('major');
  });

  it('SPEC-RUN-07, PRD-P-01: every Finding belongs to a Requirement of the Contract, and Measurements carry both source tags', async () => {
    const w = await world();
    const run = await w.service.start('project-1', w.ctxFor(), w.on);
    const contract = await w.store.getContract(run.contractId);
    const ids = new Set(contract?.requirements.map((r) => r.id));
    for (const f of w.service.findings(run)) {
      expect(ids.has(f.requirementId)).toBe(true);
      for (const m of f.evidence.measurements) expect(m.source.observed).toBeDefined();
    }
    expect(w.service.findings(run).length).toBeGreaterThan(0);
  });

  it('SPEC-RUN-06, PRD-M-10: an Inferred layout failure in a real Run is Minor and labelled', async () => {
    const overflow = domSnapshot({
      viewport: { width: W, height: H },
      document: { scrollWidth: W + 64, scrollHeight: H, clientWidth: W },
      elements: cta(100).elements,
    });
    const w = await world({
      reqs: [
        requirement({
          id: 'I-D-01',
          label: 'inferred',
          check: { kind: 'layout-fits' },
          region: undefined,
          origin: 'rule',
        }),
      ],
      captures: [{ viewport: 'desktop', dom: overflow }],
    });
    const run = await w.service.start('project-1', w.ctxFor({ status: status() }), w.on);
    expect(run.results[0]?.finding).toMatchObject({ severity: 'minor', label: 'inferred', status: 'fail' });
    expect(run.results[0]?.finding?.statement).toMatch(/\(inferred\)/);
  });
});

describe('sort (SPEC-RUN-08, PRD-F-05.3)', () => {
  const svc = createRunService({} as never);
  const f = (over: Partial<Finding>): Finding =>
    finding({ id: `x:${over.requirementId}:${over.viewport ?? 'desktop'}`, ...over });
  const order = (fs: Finding[]) => {
    const r: Run = sampleRun({
      results: fs.map((x) =>
        requirementResult({ requirementId: x.requirementId, viewport: x.viewport, status: x.status, finding: x }),
      ),
    });
    return svc.findings(r).map((x) => `${x.requirementId}:${x.viewport}`);
  };

  it('SPEC-RUN-08: severity first (Critical, Major, Minor)', () => {
    expect(
      order([
        f({ requirementId: 'R-01', severity: 'minor' }),
        f({ requirementId: 'R-02', severity: 'critical' }),
        f({ requirementId: 'R-03', severity: 'major' }),
      ]),
    ).toEqual(['R-02:desktop', 'R-03:desktop', 'R-01:desktop']);
  });

  it('SPEC-RUN-08: within a severity, fail before needs-review', () => {
    expect(
      order([f({ requirementId: 'R-01', status: 'needs-review' }), f({ requirementId: 'R-02', status: 'fail' })]),
    ).toEqual(['R-02:desktop', 'R-01:desktop']);
  });

  it('SPEC-RUN-08: then Explicit before Inferred, then desktop before mobile, then requirement id', () => {
    expect(
      order([
        f({ requirementId: 'I-M-01', label: 'inferred', viewport: 'mobile' }),
        f({ requirementId: 'R-02', viewport: 'mobile' }),
        f({ requirementId: 'R-10' }),
        f({ requirementId: 'R-02' }),
      ]),
    ).toEqual(['R-02:desktop', 'R-10:desktop', 'R-02:mobile', 'I-M-01:mobile']);
  });

  it('SPEC-RUN-08: ids sort in natural order (R-2 before R-10) and the sort is stable for equal keys', () => {
    expect(order([f({ requirementId: 'R-10' }), f({ requirementId: 'R-2' })])).toEqual(['R-2:desktop', 'R-10:desktop']);
  });

  it('SPEC-RUN-08: results without a Finding are ignored; an empty Run gives an empty list', () => {
    const r = sampleRun({ results: [requirementResult({ status: 'pass', finding: undefined })] });
    expect(svc.findings(r)).toEqual([]);
    expect(svc.findings(sampleRun({ results: [] }))).toEqual([]);
  });
});
