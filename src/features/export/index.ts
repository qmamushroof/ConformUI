import {
  type Contract,
  type ContractExportV1,
  ContractExportV1Schema,
  type Finding,
  type Project,
  type ReportExportV1,
  ReportExportV1Schema,
  type Run,
  type ViewportId,
} from '@kernel';
import {
  APP_VERSION,
  CONFIDENCE_NAME,
  compareFindings,
  ENGINE_NAME,
  isoDate,
  isoTime,
  md,
  measurementText,
  pageUrl,
  plain,
  projectViewports,
  REASON_TEXT,
  runViewports,
  SEVERITY_NAME,
  slug,
  stamp,
  VIEWPORT_NAME,
  viewportWithWidth,
} from './format';

// Public API of features/export (SPEC §4.10.1). Pure functions, no UI, no I/O.

// ContractExportV1 / ReportExportV1 are the kernel zod-inferred types (SPEC-EXP-02, SPEC-EXP-03).
export type { ContractExportV1, ReportExportV1 };

const SEP = ' · ';

const isActionable = (f: Finding): boolean => f.status === 'fail' || f.status === 'needs-review';

export function fixPrompt(i: {
  project: Project;
  contract: Contract;
  run: Run;
  findings: Finding[];
  scope?: { findingIds?: string[]; viewport?: ViewportId }; // [P1] PRD-F-09.2
}): string {
  const ids = i.scope?.findingIds ? new Set(i.scope.findingIds) : undefined;
  const items = i.findings
    .filter(isActionable)
    .filter((f) => (ids ? ids.has(f.id) : true) && (i.scope?.viewport ? f.viewport === i.scope.viewport : true))
    .sort((a, b) => (a.label === b.label ? compareFindings(a, b) : a.label === 'explicit' ? -1 : 1));
  const url = pageUrl(i.project, i.run);
  const lines = [
    `You are fixing a web page so it matches its design. Page: "${plain(i.project.name, 120)}"${url ? `, URL: ${url}` : ''}.`,
    `Viewports checked: ${runViewports(i.run).map(viewportWithWidth).join(', ')}. Contract version ${i.contract.version}, run ${isoDate(i.run.createdAt)}.`,
  ];
  if (items.length === 0) {
    lines.push('Nothing to fix: no failing or needs-review items.');
    return `${lines.join('\n')}\n`;
  }
  lines.push('Fix ONLY the items below. Leave everything that already passes unchanged.', '');
  items.forEach((f, n) => {
    const tags = [
      SEVERITY_NAME[f.severity],
      VIEWPORT_NAME[f.viewport],
      f.label === 'explicit' ? 'Explicit' : 'Inferred',
    ];
    if (f.status === 'needs-review') tags.push('verify first');
    const suffix = f.label === 'inferred' ? ' (inferred)' : '';
    lines.push(`${n + 1}. [${tags.join(SEP)}] ${plain(f.requirementId, 40)} ${plain(f.statement)}${suffix}`);
    const observed = f.evidence.measurements.map((m) => plain(measurementText(m)));
    lines.push(
      `   Observed: ${observed.length > 0 ? observed.join('; ') : 'no measurement recorded, verify against the design'}.`,
    );
    if (f.evidence.selector) lines.push(`   Element: ${plain(f.evidence.selector, 200)}`);
    lines.push(`   Suggested fix: ${plain(f.suggestedFix)}`, `   Done when: ${plain(f.condition)}`, '');
  });
  lines.push(
    'Inferred items are advisory: no design shows that viewport.',
    'After fixing, take new screenshots and DOM snapshots at the same widths so the result can be re-verified.',
  );
  return `${lines.join('\n')}\n`;
}

export function contractMarkdown(c: Contract, p: Project): string {
  const lines = [
    `# Contract: ${md(p.name, 120)}`,
    '',
    `Version ${c.version}, ${c.locked ? 'locked' : 'draft'}, ${isoDate(c.createdAt)}. ${c.requirements.length} requirements.`,
    '',
  ];
  if (c.requirements.length === 0) lines.push('No requirements.');
  else {
    lines.push(
      '| ID | Viewport | Label | Check | Origin | Engine | Statement | Condition |',
      '|---|---|---|---|---|---|---|---|',
    );
    for (const r of c.requirements) {
      const engine = r.engine ? ENGINE_NAME[r.engine] : 'n/a';
      lines.push(
        `| ${md(r.id, 40)} | ${VIEWPORT_NAME[r.viewport]} | ${r.label} | ${r.checkType} | ${r.origin} | ${engine} | ${md(r.statement)} | ${md(r.condition)} |`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

export function contractJson(c: Contract, p: Project): ContractExportV1 {
  return ContractExportV1Schema.parse({
    schema: 'conformui.contract',
    version: 1,
    exportedAt: isoTime(c.createdAt),
    app: { version: APP_VERSION },
    project: { name: p.name, viewports: projectViewports(p, c) },
    contract: {
      version: c.version,
      locked: c.locked,
      requirements: c.requirements.map((r) => ({ ...r, engine: r.engine ?? null })),
    },
  });
}

function counts(run: Run) {
  const n = (s: string) => run.results.filter((r) => r.status === s).length;
  return { pass: n('pass'), fail: n('fail'), review: n('needs-review'), notChecked: n('not-checked') };
}

export function reportMarkdown(i: { project: Project; contract: Contract; run: Run; findings: Finding[] }): string {
  const { pass, fail, review, notChecked } = counts(i.run);
  const lines = [`# Report: ${md(i.project.name, 120)}`, ''];
  if (i.run.precomputed) lines.push('> Sample results (pre-computed)', '');
  lines.push(
    `${pass} passing, ${fail} failing, ${review} needs review, ${notChecked} not checked. Contract version ${i.contract.version}, run ${isoDate(i.run.createdAt)}.`,
    '',
    '## Engine trace',
    '',
    '| Step | Engine | Duration | Bytes sent |',
    '|---|---|---|---|',
  );
  for (const t of i.run.trace) {
    lines.push(`| ${md(t.step, 80)} | ${ENGINE_NAME[t.engine]} | ${Math.round(t.durationMs)} ms | ${t.bytesSent} |`);
  }
  lines.push('');
  const findings = i.findings.filter(isActionable).sort(compareFindings);
  if (findings.length === 0) lines.push('No findings.', '');
  for (const sev of ['critical', 'major', 'minor'] as const) {
    const group = findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    lines.push(`## ${SEVERITY_NAME[sev]} (${group.length})`, '');
    for (const f of group) {
      const flag = f.status === 'needs-review' ? `${SEP}Needs review (verify first)` : '';
      const label = f.label === 'explicit' ? 'Explicit' : 'Inferred';
      lines.push(
        `### ${md(f.requirementId, 40)}${SEP}${VIEWPORT_NAME[f.viewport]}${SEP}${label}${flag}`,
        '',
        `- Statement: ${md(f.statement)}`,
        `- Engine: ${ENGINE_NAME[f.engine]}`,
        `- Confidence: ${CONFIDENCE_NAME[f.confidence]}`,
      );
      for (const m of f.evidence.measurements) lines.push(`- Measurement: ${md(measurementText(m))}`);
      if (f.evidence.selector) lines.push(`- Element: ${md(f.evidence.selector, 200)}`);
      lines.push(`- Suggested fix: ${md(f.suggestedFix)}`, `- Done when: ${md(f.condition)}`, '');
    }
  }
  const statementOf = (id: string, vp: ViewportId): string => {
    const reqs = i.contract.requirements;
    const r = reqs.find((x) => x.id === id && x.viewport === vp) ?? reqs.find((x) => x.id === id);
    return r ? md(r.statement) : '';
  };
  const passing = i.run.results.filter((r) => r.status === 'pass');
  lines.push(`## Passing (${passing.length})`, '');
  if (passing.length === 0) lines.push('None.');
  for (const r of passing) {
    lines.push(
      `- ${md(r.requirementId, 40)}${SEP}${VIEWPORT_NAME[r.viewport]}${SEP}${ENGINE_NAME[r.engine]}: ${statementOf(r.requirementId, r.viewport)}`,
    );
  }
  const unchecked = i.run.results.filter((r) => r.status === 'not-checked');
  lines.push('', `## Not checked (${unchecked.length})`, '');
  if (unchecked.length === 0) lines.push('None.');
  for (const r of unchecked) {
    const why = r.reason ? REASON_TEXT[r.reason] : 'not checked';
    const hint = r.hint ? `. ${md(r.hint)}` : '';
    lines.push(`- ${md(r.requirementId, 40)}${SEP}${VIEWPORT_NAME[r.viewport]}: ${why}${hint}`);
  }
  return `${lines.join('\n')}\n`;
}

export function reportJson(i: { project: Project; contract: Contract; run: Run; findings: Finding[] }): ReportExportV1 {
  const byId = new Map(i.findings.map((f) => [f.id, f]));
  const results = i.run.results.map((r) => {
    const f = r.finding ? (byId.get(r.finding.id) ?? r.finding) : undefined;
    return f ? { ...r, finding: f } : r;
  });
  // SPEC-EXP-05: every number carries its source tag; refuse to export otherwise.
  for (const r of results) {
    for (const m of r.finding?.evidence.measurements ?? []) {
      if (m.design !== undefined && !m.source.design) {
        throw new Error(`Measurement "${m.name}" has a design value without a source tag`);
      }
    }
  }
  return ReportExportV1Schema.parse({
    schema: 'conformui.report',
    version: 1,
    exportedAt: isoTime(i.run.createdAt),
    app: { version: APP_VERSION },
    project: { name: i.project.name, viewports: projectViewports(i.project, i.contract, i.run) },
    contract: { id: i.contract.id, version: i.contract.version },
    run: {
      id: i.run.id,
      createdAt: i.run.createdAt,
      viewports: runViewports(i.run),
      thresholds: i.run.thresholds,
      summary: counts(i.run),
      changes: i.run.changes,
      trace: i.run.trace,
      precomputed: i.run.precomputed,
    },
    results,
  });
}

/** [P1] PRD-F-09.5, zod-validated, new ids. */
export function importContract(_json: unknown): Contract {
  throw new Error('not implemented');
}

/** `conformui-<slug>-<kind>-YYYYMMDD-HHmm.<ext>` (UTC) */
export function fileName(kind: 'contract' | 'report', p: Project, ext: 'md' | 'json', at: number): string {
  return `conformui-${slug(p.name)}-${kind}-${stamp(at)}.${ext}`;
}
