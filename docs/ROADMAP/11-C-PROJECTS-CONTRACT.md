# 11. Projects and Contract

**[◀ 10. Run](10-B-RUN.md)** · [Roadmap index](../ROADMAP.md) · **[12. Settings, Deep, Export ▶](12-C-SETTINGS-DEEP-EXPORT.md)**

| | |
|---|---|
| **Depends on** | G0. Budget 1.8 h, lane C, Day 1 (11.3 Day 2) |
| **Delivers** | `features/projects` service; `features/contract` service with extraction, Inferred items, review, lock; prompts `extract-contract.v1.md`, `infer-responsive.v1.md` |
| **Read** | SPEC §4.6.1–4.6.2, §4.7, §4.4.2 (SPEC-MEAS-04), §4.1.4, §9 (S7, S8, S9, S12, S24) |
| **Covers** | SPEC-PROJ-01..07, SPEC-MEAS-04, SPEC-CON-01..09, SPEC-SEC-07, PRD-F-01.1, PRD-F-01.2, PRD-F-02.1..02.4, PRD-F-02.6, PRD-F-03.1..03.6, PRD-F-08.3, PRD-P-04, PRD-H-05, PRD §11 items 2, 3, 11 |

Services only; screens are 13.3 and 13.4. Tests use the 3.6 in-memory stores, the fake engine and a stub `MeasureClient` until M2 brings `inlineMeasureClient`.

### 11.1 ProjectsService · C · 0.5 h · needs G0
- [ ] `create`, `list` summaries, `get`, `remove` (SPEC-PROJ-06, PRD-F-01.2).
- [ ] `addDesign`, `addCapture`, `attachSnapshot` through `ImageCodec` with errors naming the limit; replace keeps the Contract and marks that viewport stale; snapshot width re-normalises (SPEC-PROJ-01..05).
- [ ] `suggestViewport(file)` = `ImageCodec.probe` + kernel `suggestViewport` (SPEC-MEAS-04, SPEC-KERNEL-12); consent grant/revoke with token only; `cloudUsage` (SPEC-PROJ-07).

**Accept:** SPEC §4.6.4 service tests: replace marks only that viewport stale; grant without token rejected; usage accumulates; viewport suggestion table.

### 11.2 Contract extraction · C · 0.75 h · needs 11.1
- [ ] `extract` steps 1–9 of SPEC-CON-01: plan per design, `needs-consent` returns `SendList` with zero calls, bands, sequential calls, box mapping, snapping, `CheckSpec` mapping, dedupe, ids, trace, per-band failure notice.
- [ ] Output versioning and sample pending contract (SPEC-CON-09); `prompts/extract-contract.v1.md` per SPEC-CON-02 with the data wrapper (SPEC-SEC-07).

**Accept:** SPEC §4.7.6: fixture boxes → snapped rects, ids, engine labels; malformed twice → band notice, other bands kept; numbers in statements replaced; `needs-consent` path makes zero `ai.run` calls (PRD-M-06); existing Contract → new unlocked version keeping manual items; sample → `pendingAiContractId`.

### 11.3 Inferred items, review, lock · C · 0.55 h · needs 11.2
- [ ] Text-only and no-AI path (SPEC-CON-03); rule-based Inferred generation (SPEC-CON-04, S8, S24). The AI proposer (`prompts/infer-responsive.v1.md`) stays behind `feature_ai_infer_responsive`, default `false` (SPEC §4.1.6); build it only if buffer remains after M4 (unbudgeted).
- [ ] `accept`, `editText`, `remove`, `add`, `loadCommitted`, `useAiContract`, `loadPrecomputedExtraction` (stored as `pendingAiContractId`, `origin:'precomputed'`, SPEC-DEMO-05); lock and versioning (SPEC-CON-05, SPEC-CON-06); region display data (SPEC-CON-07); row fields (SPEC-CON-08).

**Accept:** desktop-only design → `I-M-01` layout-fits + one `visible` per primary, all Inferred (PRD-M-10); no regeneration when Inferred items exist; edit after a Run → version 2 while the Run keeps version 1; locked edit without copy → `CONTRACT_LOCKED`.

## Exit gate

- `npm run check:fast` green; imports only kernel (and measure for types). 11.1–11.2 merged at M1; 11.3 at M2.
