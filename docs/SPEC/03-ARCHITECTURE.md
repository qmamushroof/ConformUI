# 3. Architecture

**[◀ 2. Stack](02-STACK.md)** · [SPEC index](../SPEC.md) · **[4.1 kernel ▶](04-01-KERNEL.md)**

Feature-based modular monolith, evolutionary; light DDD only in the kernel (types + ports); one static SPA, no backend (PRD-D-02, PRD-D-03).

## 3.1 Repository tree

```
package.json  package-lock.json  tsconfig.base.json  tsconfig.json (solution)  biome.json  .nvmrc
vite.config.ts  playwright.config.ts  .dependency-cruiser.cjs  firebase.json  .firebaserc
remoteconfig.template.json  .env.example  LICENSE (Apache-2.0)  README.md  docs/
.github/workflows/ci.yml  .github/dependabot.yml  pwa-assets.config.ts
public/icon.svg (copy of docs/brand/logo.svg)  public/favicon.svg (copy of docs/brand/favicon.svg)
scripts/capture-sample.mjs  scripts/check-size.mjs  docs/brand/logo.svg (logo source, PRD-D-31)
sample-site/  design.html  flawed/index.html  fixed/index.html  assets/ (fonts, svg art)   (§4.11)
src/
  shared/kernel/          types, ports, zod schemas, runtime-values.ts, consent, mode resolution, pure helpers, errors
  platform/firebase/      app init, App Check, Remote Config      -> RuntimeConfig (impl only)
  platform/ai-engine/     Firebase AI Logic hybrid adapter        -> AiEngine
  platform/storage/       IndexedDB (idb)                         -> ProjectStore, BlobStore, SettingsStore
  platform/imaging/       browser decode/resize/encode/crop       -> ImageCodec
  features/measure/       deterministic engine (pure TS, pixelmatch) -> MeasureApi
  features/dom-snippet/   snippet.js source, snapshot parse/validate (+ ui/)
  features/projects/      Projects, inputs per viewport (+ ui/)
  features/contract/      extraction, snapping, inferred reqs, review, prompts/ (+ ui/)
  features/run/           Verification Run, Findings, Re-verify, prompts/ (+ ui/)
  features/deep-analysis/ confirm sheet, cloud pass, merge, prompts/ (+ ui/)
  features/export/        Fix prompt, Markdown/JSON exports
  features/demo/          sample loader, sample/ assets (incl. sample/precomputed/) (+ ui/)
  features/settings/      engine panel, mode, consent, privacy counter, onboarding (+ ui/)
  app/                    compose.ts, routes, layout, sw.ts, main.tsx, env.ts,
                          copy.ts, styles/tokens.css, testing/fake-ai-engine.ts (E2E seam only)
tests/{unit,component,architecture,e2e}/  tests/fixtures/  tests/tsconfig.json
tests/architecture/modules.json (single module table, §3.5)  tests/architecture/fixtures/violation/ (§3.6)
```

`SPEC-ARCH-00`: each module folder has `index.ts` (public API), `tsconfig.json`, private files, optional `ui/` (React) and `prompts/`. Tests live in `tests/`. The only test-support code under `src/` is `app/testing/`, loaded via dynamic `import()` behind `import.meta.env.VITE_E2E` and proven absent from `dist/` (`SPEC-TEST-02`).

## 3.2 Modules and allowed dependencies

`SPEC-ARCH-01`: a module imports only the modules in its "May import" cell. Anything else is a violation.

| Module | Alias | May import | npm packages allowed |
|---|---|---|---|
| `shared/kernel` | `@kernel` | nothing | `zod` only |
| `platform/firebase` | `@fb` | kernel | `firebase/app`, `firebase/app-check`, `firebase/remote-config` |
| `platform/ai-engine` | `@ai` | kernel, firebase | `firebase/ai` |
| `platform/storage` | `@store` | kernel | `idb` |
| `platform/imaging` | `@imaging` | kernel | none (browser APIs) |
| `features/measure` | `@measure` | kernel | `pixelmatch` |
| `features/dom-snippet` | `@snippet` | kernel | react |
| `features/projects` | `@projects` | kernel | react |
| `features/contract` | `@contract` | kernel, measure | react |
| `features/run` | `@run` | kernel, measure | react |
| `features/deep-analysis` | `@deep` | kernel | react |
| `features/export` | `@export` | kernel | none |
| `features/demo` | `@demo` | kernel | react |
| `features/settings` | `@settings` | kernel | react |
| `app` | — | every module | react, react-router, workbox-window, workbox-* (sw) |

`SPEC-ARCH-02`: features never import `platform/*`; they receive ports (kernel interfaces) from the composition root `app/compose.ts`. Feature-to-feature flow (Run → Deep Analysis → Export) is wired in `app` routes through kernel types, never by feature imports. `measure` is a pure library shared by `contract` and `run`; it has no UI and no I/O. Only `app/compose.ts` imports `@fb`/`@ai`, and only via dynamic `import()` (`SPEC-PERF-04`).

## 3.3 Public API rule

`SPEC-ARCH-03`: cross-module imports go through the alias → `index.ts`. Deep imports (`@run/internal/x`, `../run/x`) are forbidden. `index.ts` exports types, factory functions, pure functions and components only.

## 3.4 Compiler enforcement

`SPEC-ARCH-04`: every module has a `composite: true` tsconfig whose `references` equal its §3.2 row; root `tsconfig.json` references all; `npm run typecheck` = `tsc -b`. Importing a non-referenced module fails with TS6305/TS6307. `paths` aliases live once in `tsconfig.base.json` (no `baseUrl`, TS 6); `emitDeclarationOnly: true`, `outDir: node_modules/.cache/tsc/<module>`. `kernel` sets `"lib": ["ES2023", "DOM"]` for types only (`Blob`, `AbortSignal` in ports; runtime purity via `SPEC-ARCH-06` (e)); `measure` sets `"lib": ["ES2023"]`, `"types": []` (no DOM). Both run unchanged in Node, a page, a future Worker or an extension. `types: ["vite/client"]` only in modules using `import.meta.env`/`?raw`/`import.meta.glob` (`app`, `platform/firebase`, features with `prompts/`, `dom-snippet`, `demo`). `tests/tsconfig.json` references every module.

## 3.5 Tool enforcement (dependency-cruiser)

`SPEC-ARCH-10` single module table: `tests/architecture/modules.json` lists each module's path, alias, allowed modules and allowed npm packages (§3.2). It is the only source for: `tsconfig.base.json` `paths` and each module's `references` (checked by test (b)/(f)), Vite and Vitest `resolve.alias` (read in `vite.config.ts`), and the dependency-cruiser rules. Adding a module = one row here + its folder.

`SPEC-ARCH-05`: `.dependency-cruiser.cjs` with `options: { tsConfig: { fileName: 'tsconfig.base.json' }, tsPreCompilationDeps: true }`; all rules `error`:

| Rule | Asserts |
|---|---|
| `no-circular` | no cycles |
| `layer-allow-list` | generated from the §3.2 table |
| `index-only` | cross-module imports resolve to `<module>/index.ts` |
| `kernel-pure` | kernel imports only `zod` |
| `measure-pure` | measure imports only kernel + `pixelmatch`; no `react` |
| `firebase-confined` | `firebase/*` only under `platform/firebase` and `platform/ai-engine`; `firebase/ai` only under `platform/ai-engine` |
| `idb-confined` / `pixelmatch-confined` | `idb` only in `platform/storage`; `pixelmatch` only in `features/measure` |
| `no-orphans` | no unreferenced files (except tests, `sw.ts`, `app/testing/**`, `snippet.js`) |
| `no-test-in-src` | production code never imports `tests/` or `vitest`; `app/testing/**` only from `app/compose.ts` via dynamic `import()` |

## 3.6 Architecture tests

`SPEC-ARCH-06`: `tests/architecture/` runs (a) dependency-cruiser's programmatic API over `src/` → zero violations; (b) each module tsconfig `references` equals its `modules.json` row; (c) every module has `index.ts`; (d) `package.json` has only exact versions; (e) `kernel`/`measure` sources contain no `window`, `document`, `self.`, `fetch(`; (f) `tsconfig.base.json` `paths` and `vite.config.ts` aliases equal `modules.json`; (g) **negative fixture**: `tests/architecture/fixtures/violation/` (a mini project with a feature importing `@fb`) must make both `tsc -b` fail with TS6307 and depcruise report `layer-allow-list`. CI also runs `npm run depcruise`.

## 3.7 Extension points

| ID | Point |
|---|---|
| `SPEC-ARCH-07` | [Later] **Chrome extension**: second composition root `extension/` (MV3 side panel) composing the same features and platform modules; adds a `platform/capture` module implementing a kernel `CaptureSource` port (`chrome.tabs.captureVisibleTab` + injecting `snippet.js`). P0 constraint: features take captures only as kernel `Capture` values and never call `window.location`/router APIs directly (navigation callbacks are props). |
| `SPEC-ARCH-08` | New check kinds = a new `CheckSpec` variant in kernel + a handler in `measure`/`run` registry (`SPEC-RUN-03`); no other module changes. |
| `SPEC-ARCH-09` | New AI tasks = a new `AiTask` value + zod schema in kernel + prompt file; the adapter is task-agnostic. |

## 3.8 Build order (parallel workers)

`SPEC-ARCH-11`: **Step 0 = kernel freeze.** One worker writes `shared/kernel` (types, ports, schemas, runtime values, helpers), `modules.json`, all module skeletons (`index.ts`, `tsconfig.json`), each `index.ts` declaring its SPEC public API with stub factories, `app/testing/fake-ai-engine.ts` and `tests/fixtures/ai/`, and the architecture tests; merged before anything else. Kernel changes afterwards need a SPEC edit and a coordinated merge. Then three parallel workers (git worktrees), each owning disjoint folders:

| Worker | Owns |
|---|---|
| A | `platform/firebase`, `platform/ai-engine`, `platform/storage`, `platform/imaging`, `app` (compose, routes, PWA, sw) except `app/styles/` and `app/copy.ts` |
| B | `features/measure`, `features/dom-snippet`, `features/demo`, `features/run` (service, check handlers, `index.ts`; not `ui/`), `sample-site/`, `scripts/capture-sample.mjs` |
| C | `features/projects`, `features/contract`, `features/settings`, `features/deep-analysis`, `features/export`; every `features/*/ui/**` (exported via `ui/index.ts`, re-exported by the module `index.ts` once in step 0); `app/styles/`, `app/copy.ts` |
