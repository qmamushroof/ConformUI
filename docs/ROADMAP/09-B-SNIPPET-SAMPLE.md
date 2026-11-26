# 9. Snippet and Sample

**[◀ 8. Measure](08-B-MEASURE.md)** · [Roadmap index](../ROADMAP.md) · **[10. Run ▶](10-B-RUN.md)**

| | |
|---|---|
| **Depends on** | G0; 9.5 needs 8.2. Budget 2.0 h, lane B, Day 1 (9.5 Day 2) |
| **Delivers** | `snippet.js` + `parseSnapshot`; `sample-site/` pages; committed captures and snapshots; `features/demo` services, verified `contract.json`, seeded `precomputed/` |
| **Read** | SPEC §4.5, §4.11, §7.3, §9 (S9, S25, S28); PRD §10 defect table |
| **Covers** | SPEC-SNIP-01..08, SPEC-DEMO-01..07, SPEC-SEC-03, SPEC-SEC-12, PRD-F-10.1..10.5, PRD-F-13.1..13.7, PRD-D-22, PRD-D-24, PRD-D-28, PRD §11 items 6, 8 |

Touches `src/features/dom-snippet` and `src/features/demo` (not their `ui/`), `sample-site/`, `scripts/capture-sample.mjs`. UI parts (`SnippetPanel`, `SnapshotPasteField`, `TrySampleButton`, `SampleBanner`, `LoadFixedButton`) are lane C (13.3, 13.6).

### 9.1 snippet.js · B · 0.5 h · needs G0
- [x] Plain ES2020 IIFE: element selection (SPEC-SNIP-02), selectors (SPEC-SNIP-03), names and text (SPEC-SNIP-04), overflow flags (SPEC-SNIP-05), output and size cap (SPEC-SNIP-06), privacy rules (SPEC-SNIP-07).
- [x] Export `SNIPPET_VERSION`, `snippetSource` (`?raw`).

**Accept:** static test scans `snippet.js` for every banned token of SPEC-SNIP-07; runtime proof is E7 (14.2).

### 9.2 parseSnapshot · B · 0.2 h · needs G0
- [x] Size cap before `JSON.parse`, zod `DomSnapshotV1`, human messages, version check, width-mismatch warning (SPEC-SNIP-01, SPEC-SNIP-08, SPEC-SEC-12).

**Accept:** fixtures in `tests/fixtures/snapshots/`: invalid JSON (line), wrong version, oversized, width mismatch, ≤ 5 messages.

### 9.3 Sample site · B · 0.55 h · needs G0
- [x] `sample-site/design.html`, `flawed/index.html`, `fixed/index.html`, `assets/` (OFL font with its licence file, inline SVG art). Unbranded: nav placeholder "Sample Co." (S28, PRD-D-28). Original copy and artwork only.
- [x] Planted defects with the exact values of the SPEC-DEMO-01 table; fixed page leaves defect 6 unfixed; passing items present (logo, footer, mobile CTA visible).
- [x] A text input inside the flawed page for the E7 privacy test.

**Accept:** values asserted on the captured snapshots in 9.4.

### 9.4 Capture script and committed outputs · B · 0.25 h · needs 9.1, 9.3
- [x] `scripts/capture-sample.mjs` per SPEC-DEMO-07; run it; commit outputs to `src/features/demo/sample/` with the SHA-256 list.

**Accept:** SPEC §4.5.6 values: 390 px flawed `overflow.horizontalPx = 64`, nav link count 3; 1440 px CTA box width 132; size budgets pass (SPEC-DEMO-06).

### 9.5 Demo feature and verified Contract · B · 0.5 h · needs 8.2, 9.4
- [x] `loadSampleAssets()` lazy via `import.meta.glob` + `?url` (SPEC-DEMO-06); `compareWithVerified` with kernel `iou` (SPEC-DEMO-03).
- [x] `contract.json`: hand-authored `R-01…R-07`, passing items and `I-M-01`, `I-M-02` (SPEC-DEMO-01), regions checked against `snapRegion`.
- [x] `precomputed/*.json`: valid `PrecomputedJudged` seed (flawed, fixed, deep, extraction) so tests and the offline demo work; re-recorded from a real run in 14.4 (SPEC §4.11.2).

**Accept:** SPEC-MEAS-07 test: snapping returns every verified region within 2 px; `compareWithVerified` unit test; sample assets absent from the initial chunk (size check).

## Exit gate

- `npm run check:fast` green. 9.1–9.4 merged at M1; 9.5 at M2.
