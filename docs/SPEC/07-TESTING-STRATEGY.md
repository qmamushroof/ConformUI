# 7. Testing Strategy

**[◀ 6. Security, Privacy, Performance](06-SECURITY-PRIVACY-PERFORMANCE.md)** · [SPEC index](../SPEC.md) · **[8. Deploy ▶](08-DEPLOY.md)**

Every module is testable alone through its public API and ports. Real AI is never called in CI.

## 7.1 Layers

| Layer | Tool | Location | Scope |
|---|---|---|---|
| Unit | Vitest (node) | `tests/unit/<module>/` | kernel (`resolveMode` table, `guardNumbers`, schemas), measure (on committed PNGs via `pngjs`), snippet parsing, contract/run services with fakes, `compareRuns`, export, storage (`fake-indexeddb`), RC parsing, schema mapper, contrast |
| Component | Vitest + jsdom + Testing Library | `tests/component/` | EngineBadge, ConsentSheet, DeepConfirmSheet, FindingDetail, ComparisonView toggles, StateNotice per code, EnginePanel states |
| Architecture | Vitest + dependency-cruiser API + `tsc -b` on the negative fixture | `tests/architecture/` | `SPEC-ARCH-01..06`, `SPEC-ARCH-10` |
| E2E | Playwright (Chromium) on `vite build --mode e2e` + `vite preview` | `tests/e2e/` | full flows, offline, PWA, consent network spy, snippet on sample-site, axe |
| Manual smoke | README "Verify" checklist | — | real Chrome with on-device model + real Firebase: extract on sample, Run, Deep Analysis; record `inferenceSource`, timings, PRD-M-07, PRD-M-14 |

## 7.2 AI test seam (`SPEC-TEST-01`)

- `FakeAiEngine` (`src/app/testing/fake-ai-engine.ts`, kernel-only imports) implements `AiEngine`: scripted `EngineStatus`, per-task canned JSON (including malformed fixtures), engine selection that mimics the SDK (`ONLY_ON_DEVICE` → `on-device`; `PREFER_ON_DEVICE` → `on-device` if status available else `cloud`; `ONLY_IN_CLOUD` → `cloud`), records every request in `calls[]`, enforces `SPEC-AI-02`.
- E2E: `compose.ts` loads it via dynamic `import()` behind `import.meta.env.VITE_E2E` and skips `@fb`/`@ai` entirely (`SPEC-APP-01`); tests configure it through `window.__CUI_FAKE__` (`page.addInitScript`) and read `calls`. `SPEC-TEST-02`: a build test greps production `dist/` for `__CUI_FAKE__` and `FakeAiEngine` → absent.
- Status scenarios: `available+image`, `available` text-only, `downloadable`, `downloading(0.4)`, `unavailable(not-desktop-chrome)`, `unavailable(image-flag-off)`, plus `context.setOffline(true)`.
- Network spy: `page.on('request')` collects any request to `*.googleapis.com`; with the fake no real AI request should ever appear, and `calls[]` proves no cloud-mode call happened before consent.

## 7.3 Seeded data

| Fixture | Content | Used by |
|---|---|---|
| `src/features/demo/sample/*` | committed design, flawed/fixed captures, snapshots, verified Contract, precomputed outputs | `SPEC-DEMO-*`, PRD-M-01/02/09/10 |
| `tests/fixtures/ai/*.json` | valid and malformed outputs per task, outputs containing invented numbers | `SPEC-AI-06`, `SPEC-KERNEL-08`, PRD-M-05, PRD-M-03 |
| `tests/fixtures/snapshots/*.json` | invalid JSON, wrong version, oversized, width-mismatch | `SPEC-SNIP-08` |
| `tests/fixtures/images/*` | AA-only differences, missing element, tall page, WebP, oversized | `SPEC-MEAS-*`, `SPEC-PROJ-02` |

## 7.4 Sample acceptance (`SPEC-TEST-03`)

`tests/unit/demo/sample-acceptance.test.ts` builds services with `inlineMeasureClient`, a Node `ImageCodec` (pngjs), `fake-indexeddb` and `FakeAiEngine` returning the precomputed Judged outputs; asserts PRD-M-01 (defects 1–6 Fail with expected check type and severity, 7 Needs review, zero Critical/Major false positives), PRD-M-02 (6 resolved, 1 remaining, 0 new/regressed), PRD-M-09 (identical statuses on re-run), PRD-M-10 (no Inferred above Minor, all labelled), PRD-M-03 (every Measurement source-tagged), and that the Fix prompt lists exactly the `fail` and `needs-review` Findings, the latter marked "verify first".

## 7.5 Required E2E scenarios

| # | Scenario | Asserts |
|---|---|---|
| E1 | First visit → onboarding → Try the sample → Run | Findings visible after 2 clicks from onboarding, with device `available+image` and with `unavailable` (no modal, pre-computed Judged items labelled, `SPEC-RUN-13`) (PRD-M-13); Engine labels on all items (PRD-M-04) |
| E2 | Device `available+image`, offline: Extract contract + Run on sample | completes; trace all On-device/Measured, 0 bytes; privacy counter "Nothing has left this device" (PRD-M-07 analogue) |
| E3 | Device `unavailable`: Extract | consent sheet lists images + bytes; **zero** calls before Allow; after Allow mode `PREFER_ON_DEVICE`, label Cloud; Decline → manual + rule items only (PRD-H-05, PRD-M-06) |
| E4 | Deep Analysis | confirm sheet; no call before Send; payload equals preview; "Refined by Cloud"; trace Cloud step with bytes; counter updates; offline → disabled (PRD-F-06) |
| E5 | Re-verify with fixed captures | "6 resolved, 1 remaining"; history lists 2 Runs (PRD-F-07) |
| E6 | Exports | Fix prompt copied text matches snapshot; MD/JSON downloads validate (PRD-F-09) |
| E7 | DOM snippet | run `snippetSource` on `sample-site/flawed/` at 390 px: zero network requests, no form value in output; paste into app accepted; invalid paste shows errors (PRD-F-13) |
| E8 | Inputs | picker, drag-drop, paste; unsupported/oversized error copy; viewport suggestion (PRD-F-02) |
| E9 | Projects | create, reload persists, delete removes images/runs (PRD-F-01) |
| E10 | Settings | mode switch; revoke consent → asks again; clear data; download button calls `downloadDeviceModel` from click (PRD-F-11) |
| E11 | PWA | manifest valid; installability; second load offline opens shell and sample ≤ 1 s (PRD-F-12.1, PRD-M-12) |
| E12 | A11y | axe zero serious/critical on screens of `SPEC-UI-06`, light + dark; keyboard-only E1 + E4 (PRD-M-11) |
| E13 | Error states | each `ErrorCode` renders its copy (fake throws) (`SPEC-UI-05`) |

## 7.6 Citing SPEC IDs (`SPEC-TEST-04`)

Test titles start with the IDs they prove (`it('SPEC-RUN-10, PRD-F-07.2: …')`). No automated trace test in release 1 (advisory convention only, S18).

## 7.7 Gates

| Gate | Threshold |
|---|---|
| Blocking CI (`npm run check`) | `biome ci` → `tsc -b` → `depcruise` + architecture tests → `vitest run` → `vite build` + size check → Playwright e2e |
| Coverage (v8) | reported, advisory (no threshold) |
| Flakes | unit no retries; Playwright `retries: 1` in CI only, retry-passes reported |
| VERIFY | each resolved item recorded as a code comment citing the SPEC ID and date (§1.2) |
