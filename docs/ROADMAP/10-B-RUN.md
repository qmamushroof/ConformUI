# 10. Run

**[◀ 9. Snippet and Sample](09-B-SNIPPET-SAMPLE.md)** · [Roadmap index](../ROADMAP.md) · **[11. Projects and Contract ▶](11-C-PROJECTS-CONTRACT.md)**

| | |
|---|---|
| **Depends on** | 8.4 and 9.5; nothing from other lanes. Budget 1.85 h, lane B, Day 2 |
| **Delivers** | `features/run` service: check handlers, Run procedure, judge prompt, Findings, Re-verify, sample acceptance test |
| **Read** | SPEC §4.8, §4.1.4 (`resolveMode`), §7.4, §9 (S14, S21, S23, S25) |
| **Covers** | SPEC-RUN-01..13, SPEC-TEST-03, PRD-F-04, PRD-F-05.1..05.3, PRD-F-07.1..07.3, PRD-F-08.2, PRD-P-01, PRD-P-03, PRD-P-04, PRD-P-07, PRD-M-01, PRD-M-02, PRD-M-09, PRD-M-10, PRD §11 items 4, 5, 7, 11 |

Touches `src/features/run` (not `ui/`, which is lane C 13.5) and `tests/*/run`, `tests/unit/demo/`.

### 10.1 Check handlers · B · 0.7 h · needs 8.4, 9.5 (own branch)
- [x] One handler per `CheckSpec.kind` × `checkType` row of SPEC-RUN-03, DOM and no-DOM paths, registry keyed by kind (SPEC-ARCH-08).
- [x] Region issues → `needs-review` / `not-checked misaligned`, never a guessed number (SPEC-RUN-04, S21).

**Accept:** one test per table row with and without a DOM snapshot; unresolved region → Needs review.

### 10.2 Run procedure · B · 0.6 h · needs 10.1
- [x] `start` steps 1–4 of SPEC-RUN-01, incl. text-only judge and the per-Run `needs-consent` event; `prompts/judge.v1.md` (untrusted-data wrapper, SPEC-SEC-07).
- [x] One Run per Project, Abort keeps partial results (SPEC-RUN-02); trace steps (SPEC-RUN-12); sample precomputed path from the `start` ctx `precomputed` (SPEC-RUN-13, S25, S29).
- [x] `rejudge(runId, ctx, on)`: re-runs only the Judged stage with project consent, replaces precomputed items, same Run id, new revision (SPEC §4.8.1, SPEC-RUN-13).

**Accept:** rejudge leaves Measured/Visual results unchanged and keeps the Run id; SPEC §4.8.8: consent declined → `not-checked consent-declined` with zero cloud calls (PRD-M-06); sample with device unavailable → no event, precomputed labelled, `run.precomputed`; text-only judge uses `needsImage:false`; `no-inferred-items` hint; contract locked after save; measured steps report 0 bytes.

### 10.3 Severity, Findings, sort · B · 0.3 h · needs 10.2
- [x] Severity by impact, Inferred cap (SPEC-RUN-05, SPEC-RUN-06); deterministic templates and evidence rules, `guardNumbers` before AI text (SPEC-RUN-07, SPEC-KERNEL-08, S23); sort (SPEC-RUN-08).

**Accept:** no Inferred Finding above Minor (PRD-M-10); missing evidence → Needs review; invented-number fixture falls back to template (PRD-M-03); sort order test.

### 10.4 Re-verify, history, sample acceptance · B · 0.25 h · needs 10.3
- [x] `compareRuns`, summary line, `history` (SPEC-RUN-09..11).
- [x] `tests/unit/demo/sample-acceptance.test.ts` per SPEC-TEST-03 (node codec, `fake-indexeddb` or in-memory stores, fake engine returning precomputed Judged outputs).

**Accept:** PRD-M-01, PRD-M-02, PRD-M-03, PRD-M-09, PRD-M-10 asserted on the committed sample; the Fix prompt (`fixPrompt` from 12.3, on `main` since M1) lists exactly the `fail` and `needs-review` Findings, the latter "verify first" (S20).

## Exit gate

- `npm run check:fast` green; imports only kernel and measure. Merged at M3 (first).
