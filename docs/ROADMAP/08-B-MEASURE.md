# 8. Measure

**[◀ 7. App Shell and PWA](07-A-APP-PWA.md)** · [Roadmap index](../ROADMAP.md) · **[9. Snippet and Sample ▶](09-B-SNIPPET-SAMPLE.md)**

| | |
|---|---|
| **Depends on** | G0; sample PNGs and snapshots from 9.4. Budget 1.75 h, lane B, Day 1–2 |
| **Delivers** | `features/measure` (`measureApi`, `inlineMeasureClient`), Node test codec, image fixtures |
| **Read** | SPEC §4.4 (measure parts), §4.1.3 (`MeasureApi`), §4.1.6 (thresholds), §7.3, §9 (S6, S15, S21, S22) |
| **Covers** | SPEC-MEAS-05..16, SPEC-STACK-03, PRD-P-02, PRD-P-03, PRD-P-10, PRD-F-04.1, PRD §11 item 4 |

Pure TypeScript, no DOM types, runs in Node (SPEC-ARCH-04, SPEC-ARCH-06 (e)). Touches only `src/features/measure`, `tests/unit/measure/`, `tests/helpers/node-codec.ts`, `tests/fixtures/images/`.

### 8.1 Node test codec and image fixtures · B · 0.25 h · needs G0
- [x] `tests/helpers/node-codec.ts`: kernel `ImageCodec` over `pngjs` (`pixels`, `crop`, `composePair`; `normalise` for already-normalised PNGs) for Node tests (SPEC §7.4).
- [x] `tests/fixtures/images/*`: AA-only difference, missing element, tall page, WebP, oversized (SPEC §7.3).

**Accept:** decodes a committed PNG to an `RgbaImage` with expected size.

### 8.2 Background, ink, snapping, location · B · 0.6 h · needs 8.1, 9.4
- [ ] Background and ink (SPEC-MEAS-06); `snapRegion` (SPEC-MEAS-07); `locateOnCapture` (SPEC-MEAS-08).

**Accept:** snapping on fixtures is deterministic; locate finds a shifted crop with the tie rules; the 2 px check against the verified Contract lands in 9.5.

### 8.3 Align, diff, presence, colour, geometry · B · 0.45 h · needs 8.2
- [ ] `align` (SPEC-MEAS-05); `regionDiff` with `includeAA:false` (SPEC-MEAS-09); presence ink test (SPEC-MEAS-10); `dominantColour`, `deltaE` (SPEC-MEAS-11); geometry, `pct`, source tags (SPEC-MEAS-12).

**Accept:** SPEC §4.4.7: identical → 0, AA-only < 0.01, defect 1 missing on flawed and present on fixed; every `Measurement` has both source tags (PRD-M-03).

### 8.4 DOM facts, client, purity · B · 0.45 h · needs 8.3
- [ ] `matchElements` (SPEC-MEAS-14), `overflowFacts`, `overlaps` (SPEC-MEAS-13).
- [ ] `measureApi` and `inlineMeasureClient()` (SPEC-MEAS-15, S22); no randomness, time or locale (SPEC-MEAS-16).

**Accept:** flawed mobile `horizontalPx = 64` and nav/h1 overlap; fixed 0 and none; two runs deep-equal (PRD-M-09); architecture test (e) green.

## Exit gate

- `npm run check:fast` green; `pixelmatch` imported only here; no `react` import.
- 8.1–8.2 merged at M1; 8.3–8.4 at M2.
