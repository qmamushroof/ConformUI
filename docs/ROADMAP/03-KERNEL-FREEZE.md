# 3. Step 0: Kernel Freeze

**[◀ 2. Human Setup](02-HUMAN-SETUP.md)** · [Roadmap index](../ROADMAP.md) · **[4. VERIFY Spikes ▶](04-SPIKES.md)**

| | |
|---|---|
| **Depends on** | 2.1. Budget 3.0 h, one worker (lane 0). Gates all parallel work |
| **Delivers** | Pinned toolchain, module table, every module skeleton with its declared public API, frozen kernel, architecture tests with negative fixture, AI test seam and fixtures, CI |
| **Read** | SPEC §2, §3, §4.1, §4.x.1 public-API blocks, §7.2, §7.3, §8.1, §8.2, §8.4, §8.5 (`.gitignore`), §9 (S1, S26, S27, S29) |
| **Covers** | SPEC-STACK-01..04, SPEC-ARCH-00..06, SPEC-ARCH-10, SPEC-ARCH-11, SPEC-KERNEL-01..12, SPEC-AI-12, SPEC-TEST-01, SPEC-TEST-02, SPEC-DEPLOY-03, SPEC-SEC-10 |

### 3.1 Toolchain and pins · 0 · 0.5 h · needs 2.1
- [x] `.nvmrc` (`26`); `package.json` with every package of SPEC §2.1–2.3 at its exact version, `engines`, `"license": "Apache-2.0"`, `"repository"` (SPEC-DEPLOY-04).
- [x] Scripts: `dev`, `build`, `preview`, `typecheck` (`tsc -b`), `lint` (`biome ci`), `depcruise`, `test`, `test:e2e`, `icons`, `sample:capture`, `check:fast`, `check` (SPEC §7.7 order).
- [x] `package-lock.json`; `biome.json` (no `any`, no `dangerouslySetInnerHTML`, `console.*` only per SPEC-SEC-04); `.gitignore` (SPEC-DEPLOY-04); `.env.example` (SPEC-DEPLOY-02).

**Accept:** SPEC-STACK-04 proof on a clean clone with no peer warnings; SPEC-STACK-01.

### 3.2 Module table and skeletons · 0 · 0.6 h · needs 3.1
- [x] `tests/architecture/modules.json` = SPEC §3.2 table (SPEC-ARCH-10).
- [x] Each module: composite `tsconfig.json` whose `references` come from `modules.json`, `lib`/`types` per SPEC-ARCH-04; `ui/index.ts` (empty, re-exported by `index.ts`) where the module has UI; empty `prompts/` where SPEC §3.1 lists them.
- [x] Each `index.ts` declares the module's public API from its SPEC §4.x.1 block. Interfaces are complete; each factory is a stub that throws `new Error('not implemented')`. Lanes replace the bodies, never the signatures (a signature change follows the kernel change rule). Includes `RunService.rejudge`, `DeepService.applyPrecomputed` and `ContractService.loadPrecomputedExtraction` (S29).
- [x] `tsconfig.base.json` paths, root solution `tsconfig.json`, `tests/tsconfig.json`.
- [x] `vite.config.ts`: aliases read from `modules.json`; react, `@tailwindcss/vite`, `vite-plugin-pwa` (`injectManifest`, `registerType: 'prompt'`, placeholder `src/app/sw.ts`); `--mode e2e`; `define`/env injection of `VITE_APP_VERSION` from the git sha. Vitest (node + jsdom) and `playwright.config.ts` (e2e build + preview).
- [x] Placeholders for later lanes: `index.html` (SPEC-APP-04 metas), `src/app/main.tsx`, `src/app/styles/tokens.css`, `src/app/copy.ts`, `public/icon.svg` and `public/favicon.svg` copied unchanged from `docs/brand/` (SPEC-PWA-01), `firebase.json` per SPEC §8.1 without CSP and with `"remoteconfig": { "template": "remoteconfig.template.json" }`, `.firebaserc`.

**Accept:** `tsc -b` and `npm run build` pass; build emits a service worker; every SPEC §4.x.1 export exists with its signature; SPEC-ARCH-00, SPEC-ARCH-04.

### 3.3 Architecture enforcement · 0 · 0.4 h · needs 3.2
- [x] `.dependency-cruiser.cjs`: every SPEC-ARCH-05 rule, allow-list generated from `modules.json`.
- [x] `tests/architecture/`: checks (a)–(f) of SPEC-ARCH-06.
- [x] Negative fixture `tests/architecture/fixtures/violation/` (feature importing `@fb`): test asserts `tsc -b` fails with TS6307 and depcruise reports `layer-allow-list` (SPEC-ARCH-06 (g)).

**Accept:** SPEC-ARCH-01..06 and SPEC-ARCH-10 tests green; a scratch forbidden import in `src/` turns them red.

### 3.4 Kernel types, ports, schemas · 0 · 0.6 h · needs 3.2
- [x] SPEC §4.1.1–4.1.3 types and ports exactly as written, incl. `ImageCodec.probe` (SPEC-MEAS-04).
- [x] `SendList` (moved to kernel, S29) and `RunSummary`.
- [x] `kernel/schemas.ts`: zod for every type, `DomSnapshotV1` (SPEC-SNIP-01), `ContractExportV1`, `ReportExportV1` (SPEC-EXP-02, SPEC-EXP-03), the four AI task outputs (SPEC §4.3.4) (SPEC-KERNEL-03).
- [x] `kernel/runtime-values.ts`: `RuntimeValuesSchema` with clamps, `Thresholds`, `DEFAULT_RUNTIME_VALUES` (SPEC §4.1.6, S26).

**Accept:** valid and invalid sample per schema; one clamp test per numeric key; SPEC-KERNEL-01..03.

### 3.5 Kernel functions and errors · 0 · 0.35 h · needs 3.4
- [x] `mintConsent`, `resolveMode` (SPEC-KERNEL-04..06), limits (SPEC-KERNEL-07), `guardNumbers` (SPEC-KERNEL-08), `CuiError` with every code and `retryable` (SPEC-KERNEL-09), `iou` (SPEC-KERNEL-10), `lockContract`, `nextContractVersion` (SPEC-KERNEL-11), `suggestViewport` (SPEC-KERNEL-12).

**Accept:** full `resolveMode` table test incl. "no `PREFER_*` without consent" (PRD-M-06, S1); `isTrusted:false` → `CONSENT_REQUIRED`; one test per error code; `suggestViewport` table per SPEC-MEAS-04.

### 3.6 AI test seam, helpers, fixtures · 0 · 0.35 h · needs 3.5
- [x] `src/app/testing/fake-ai-engine.ts` per SPEC-TEST-01 and SPEC-AI-12 (status scenarios of SPEC §7.2, canned JSON per task, `calls[]`, engine selection, SPEC-AI-02 guards).
- [x] `tests/helpers/`: in-memory `ProjectStore`, `BlobStore`, `SettingsStore`; fixed `Clock`, `Ids`. `tests/fixtures/ai/<task>-*.json`: valid, malformed and invented-number outputs per task (SPEC §7.3).

**Accept:** one test per status scenario; cloud mode without a token rejected with `CONSENT_REQUIRED`.

### 3.7 CI and gates · 0 · 0.2 h · needs 3.3
- [ ] `scripts/check-size.mjs` with SPEC-PERF-04 and SPEC-DEMO-06 budgets.
- [ ] Build test: `dist/` has no `__CUI_FAKE__`, `FakeAiEngine`, `FIREBASE_APPCHECK_DEBUG_TOKEN` (SPEC-TEST-02, SPEC-FB-04).
- [ ] One Playwright smoke spec (shell renders) so the e2e stage is non-empty.
- [ ] `.github/workflows/ci.yml` (incl. `npm audit`) and `dependabot.yml` per SPEC §8.4 (SPEC-DEPLOY-03, SPEC-SEC-10).

**Accept:** CI green on a PR; a deliberate boundary break turns it red.

## Gate G0

- `npm run check` green locally and in CI; negative fixture behaves as SPEC-ARCH-06 (g) states.
- Merge to `main`, tag `kernel-v1`, create worktrees `wt-a`, `wt-b`, `wt-c` from the tag. Kernel and module APIs are frozen ([00](00-HOW-TO-USE.md) kernel change rule).
