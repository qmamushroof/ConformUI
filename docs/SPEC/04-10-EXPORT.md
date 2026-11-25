# 4.10 export

**[◀ 4.9 deep-analysis](04-09-DEEP-ANALYSIS.md)** · [SPEC index](../SPEC.md) · **[4.11 demo ▶](04-11-DEMO.md)**

`src/features/export` (kernel only, pure functions, no UI, no I/O). Fix prompt, Contract and Run report as Markdown and JSON. Realises PRD-F-09, PRD-D-21. Download/copy buttons live in `run`/`contract` UIs via `app` (Blob download + `navigator.clipboard.writeText`; clipboard failure shows the text selected for manual copy).

## 4.10.1 Public API

```ts
export function fixPrompt(i: { project: Project; contract: Contract; run: Run; findings: Finding[];
  scope?: { findingIds?: string[]; viewport?: ViewportId } /*[P1] PRD-F-09.2*/ }): string;
export function contractMarkdown(c: Contract, p: Project): string;
export function contractJson(c: Contract, p: Project): ContractExportV1;
export function reportMarkdown(i: { project: Project; contract: Contract; run: Run; findings: Finding[] }): string;
export function reportJson(i: …): ReportExportV1;
export function importContract(json: unknown): Contract;   // [P1] PRD-F-09.5, zod-validated, new ids
export function fileName(kind: 'contract' | 'report', p: Project, ext: 'md' | 'json', at: number): string; // conformui-<slug>-<kind>-YYYYMMDD-HHmm.<ext>
```

## 4.10.2 Fix prompt (`SPEC-EXP-01`, PRD-F-09.1, PRD-D-21)

Deterministic, text only, no model call; same input → byte-identical output. Includes failing **and** needs-review Findings (needs-review marked "verify first"); excludes passing items ([P1] and dismissed). Template:

```
You are fixing a web page so it matches its design. Page: "<project name>"<, URL: <snapshot url> when known>.
Viewports checked: <each Run viewport and its CSS width, e.g. Desktop 1440 px, Mobile 390 px>. Contract version <n>, run <date>.
Fix ONLY the items below. Leave everything that already passes unchanged.

1. [Major · Desktop · Explicit] R-02 Primary CTA width
   Expected: <requirement statement>
   Observed: Primary CTA is 132 px wide vs 220 px in the design (−40.0%), measured from DOM snapshot.
   Element: <selector, when known>
   Suggested fix: <suggestedFix>
   Done when: <verification condition>
...
Inferred items (advisory, no design shows this viewport): listed last with "(inferred)".
After fixing, take new screenshots and DOM snapshots at the same widths so the result can be re-verified.
```

Ordering = `SPEC-RUN-08`. Numbers appear only inside "Observed"/"Done when" from Measurements (PRD-P-02). Markdown-safe plain text (no HTML).

## 4.10.3 Contract and report (`SPEC-EXP-02..04`, PRD-F-09.3, PRD-F-09.4)

| ID | Rule |
|---|---|
| `SPEC-EXP-02` | `ContractExportV1 = { schema: 'conformui.contract', version: 1, exportedAt, app: { version }, project: { name, viewports }, contract: { version, locked, requirements: Requirement[] } }`. Each Requirement keeps `label`, `checkType`, `origin`, `engine` (or null), region `source`. No images, no snapshot text. |
| `SPEC-EXP-03` | `ReportExportV1 = { schema: 'conformui.report', version: 1, exportedAt, app, project, contract: { id, version }, run: { id, createdAt, viewports, thresholds, summary, changes, trace: TraceStep[], precomputed }, results: RequirementResult[] (with findings, measurements and source tags) }`. Crops are referenced as rects, not embedded (size, privacy). |
| `SPEC-EXP-04` | Markdown: title, summary line, engine trace table (step, engine, duration, bytes sent), Findings grouped by severity with Engine and every measurement's source tag ("132 px (DOM snapshot) vs 220 px (design image)"), then Passing / Not checked (with reasons). Pre-computed runs carry the banner "Sample results (pre-computed)". |
| `SPEC-EXP-05` | Every exported item carries its Engine and every number its source tag (PRD-F-09.4, PRD-M-03); a test walks the JSON and fails on any numeric measurement field without a source. JSON validates against the kernel zod schema before download. |

## 4.10.4 Acceptance tests

Snapshot tests of `fixPrompt`, `reportMarkdown` on the sample flawed Run; determinism (two calls equal); passing Requirements absent from the Fix prompt; JSON round-trip through zod; `SPEC-EXP-05` source-tag walk.
