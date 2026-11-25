import type { Contract, Finding, Project, Run, ViewportId } from '@kernel';

// Public API of features/export (SPEC §4.10.1). Pure functions, no UI, no I/O. Bodies: lane C (task 12.x).

// ContractExportV1 / ReportExportV1 are inferred from the kernel zod schemas (SPEC-EXP-02, SPEC-EXP-03); the kernel
// schemas land in task 3.4 and these aliases then re-point at them. Until then they are opaque records.
export type ContractExportV1 = Record<string, unknown>;
export type ReportExportV1 = Record<string, unknown>;

export function fixPrompt(_i: {
  project: Project;
  contract: Contract;
  run: Run;
  findings: Finding[];
  scope?: { findingIds?: string[]; viewport?: ViewportId }; // [P1] PRD-F-09.2
}): string {
  throw new Error('not implemented');
}

export function contractMarkdown(_c: Contract, _p: Project): string {
  throw new Error('not implemented');
}

export function contractJson(_c: Contract, _p: Project): ContractExportV1 {
  throw new Error('not implemented');
}

export function reportMarkdown(_i: { project: Project; contract: Contract; run: Run; findings: Finding[] }): string {
  throw new Error('not implemented');
}

export function reportJson(_i: {
  project: Project;
  contract: Contract;
  run: Run;
  findings: Finding[];
}): ReportExportV1 {
  throw new Error('not implemented');
}

/** [P1] PRD-F-09.5, zod-validated, new ids. */
export function importContract(_json: unknown): Contract {
  throw new Error('not implemented');
}

/** `conformui-<slug>-<kind>-YYYYMMDD-HHmm.<ext>` */
export function fileName(_kind: 'contract' | 'report', _p: Project, _ext: 'md' | 'json', _at: number): string {
  throw new Error('not implemented');
}
