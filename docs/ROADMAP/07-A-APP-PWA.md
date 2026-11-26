# 7. App Shell and PWA

**[◀ 6. Storage and Imaging](06-A-STORAGE-IMAGING.md)** · [Roadmap index](../ROADMAP.md) · **[8. Measure ▶](08-B-MEASURE.md)**

| | |
|---|---|
| **Depends on** | 7.1: 6.x and B's 8.4 (`inlineMeasureClient`, merged before A at M2). 7.2: 7.1. 7.4: 4.1. 7.3: M3 merges of lanes B and C. Budget 2.4 h, lane A, Day 2 |
| **Delivers** | Composition root, E2E seam, routes, header, error boundary, cross-feature flows, sample fallbacks, manifest, icons, service worker, install and update UX |
| **Read** | SPEC §4.13, §3.2 (row app), §4.11 (sample built by app, SPEC-DEMO-05), §4.10 intro (copy/download), §4.12 (SPEC-SET-05, SPEC-SET-06), §5.1, §9 (S13, S22, S25, S29) |
| **Covers** | SPEC-APP-01..06, SPEC-RUN-13 (wiring), SPEC-PWA-01..05, SPEC-DEMO-02, SPEC-DEMO-05, SPEC-DEMO-06 (precache), SPEC-SET-05, SPEC-SET-06, SPEC-TEST-01, SPEC-TEST-02, SPEC-PERF-04, SPEC-PERF-06, PRD-F-12.1, PRD §11 items 6, 9, 10 |

Owns `src/app/**` except `app/styles/` and `app/copy.ts` (lane C). Feature UI arrives as components; `app` passes `EngineBadge`, `ConsentSheet`, `PrivacyCounter` to other features as render props (S13). Every user-facing string comes from `app/copy.ts` (13.1).

### 7.1 env and composition root · A · 0.5 h · needs 6.1, 6.2, 8.4
- [ ] `app/env.ts` zod validation; e2e makes Firebase vars optional (SPEC-APP-06).
- [ ] `compose.ts`: storage → codec → `inlineMeasureClient()` → services with a lazy `AiEngine` proxy → dynamic `import('@fb')`/`import('@ai')` after first paint; `VITE_E2E` branch with `FakeAiEngine` and static defaults; `ServicesProvider` (SPEC-APP-01, SPEC-TEST-01, S22). Run and Deep factories are Step 0 stubs until M3.

- [ ] zod jitless (spike D1 local, 4.5): a side-effect module `app/zod-jitless.ts` calling `z.config({ jitless: true })` and imported first in `main.tsx`, before anything that imports `@kernel` (zod 4 builds object schemas, and runs its `new Function` probe, at module load). The kernel is not changed. Keeps the enforced CSP free of `'unsafe-eval'`.

**Accept:** `composeForTest()` builds the graph; prod `dist/` has no fake (SPEC-TEST-02); size check shows `firebase/*` outside the initial chunk (SPEC-PERF-04).

### 7.2 Routes, header, error handling · A · 0.5 h · needs 7.1
- [ ] Routes of SPEC §4.13.2, lazy except `/`; `/` → `/welcome` until onboarded.
- [ ] Screens from lane C mount as they merge (M2, M3); until then a route renders a placeholder heading.
- [ ] Header with logo, Engine status pill, `PrivacyCounter`, nav, Offline pill (SPEC-APP-02); per-route error boundary and rejection mapping (SPEC-APP-03); titles and theme metas (SPEC-APP-04); no third-party scripts (SPEC-APP-05).

**Accept:** router tests for redirect, lazy routes, not-found; error boundary shows Reload; title per route.

### 7.3 Cross-feature flows · A · 0.9 h · needs M3 merges of 10.x, 12.x, 13.5, 13.6
- [ ] Try the sample: `ProjectsService` + `ContractService.loadCommitted` with `loadSampleAssets()`; open Project with Run primary (SPEC-DEMO-02). Pass the lazily loaded `precomputed` in each sample Run's `start` ctx (SPEC §4.8.1).
- [ ] Project route: `ProjectInputs` + `SnapshotPasteField` + compact `EnginePanel` (Download, `enableSteps`) + `RunHistory`.
- [ ] Project consent: `needs-consent` from extract/run → `ConsentSheet` → `mintConsent` from the trusted click → `grantCloudConsent` → resume (SPEC-PROJ-07, SPEC-CON-01 step 1, SPEC-RUN-01 step 3). Settings Revoke → `ProjectsService.revokeCloudConsent` (SPEC-SET-05).
- [ ] Run → Deep Analysis (SPEC-DEEP-01) → Fix prompt copy and report/contract downloads with clipboard fallback (SPEC §4.10 intro); Load fixed → Re-verify (SPEC-DEMO-04, SPEC-RUN-09); for every Cloud `TraceStep` (extract, run, deep) call `ProjectsService.recordCloudUsage(projectId, step.bytesSent)` and set `Settings.everSentToCloud = true` (SPEC-APP-01, SPEC-SET-06).
- [ ] Sample fallbacks (SPEC-DEMO-05): extraction declined/blocked/failed → panel shows `precomputed.extraction` labelled (`ContractService.loadPrecomputedExtraction`); failed Deep → "Show pre-computed result" calls `DeepService.applyPrecomputed` with `precomputed.deep`; "Allow cloud to judge live" → consent sheet → `RunService.rejudge` (SPEC-RUN-13).

**Accept:** component test with fakes: zero `ai.run` cloud-mode calls before Allow/Send (PRD-M-06); Findings reached in 2 clicks from Projects on the sample, with device `available+image` and `unavailable` (PRD-M-13, S25); revoke then extract asks again; every Cloud step adds its bytes to the Project's `cloudUsage` and Measured/On-device steps add nothing; `everSentToCloud` flips once; both sample fallbacks labelled "Sample results (pre-computed)"; rejudge keeps the Run id.

### 7.4 Manifest, icons, service worker · A · 0.5 h · needs 4.1
- [x] Manifest fields of SPEC §4.13.3 (no `share_target`, P1); icons from `npm run icons` committed (SPEC-PWA-01).
- [x] `sw.ts`: precache incl. lazy chunks, sample assets and the 5 Latin `.woff2` font files (`globPatterns` with `woff2`, no `woff`), `NavigationRoute`, no cross-origin caching (SPEC-PWA-03, SPEC-PWA-04, SPEC-DEMO-06).
- [x] Install button from `beforeinstallprompt` (SPEC-PWA-02); update toast via `workbox-window` (SPEC-PWA-05).

**Accept:** manifest field test; route/denylist config test; no cross-origin strategy; precache manifest lists exactly 5 `.woff2` font files and no `.woff`; update toast test with a stubbed `waiting` event.

## Exit gate

- `npm run check` green; the e2e build runs the sample flow end to end with the fake engine (M3).
