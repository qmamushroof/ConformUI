# 2. Stack

**[◀ 1. Document Identity](01-DOCUMENT-IDENTITY.md)** · [SPEC index](../SPEC.md) · **[3. Architecture ▶](03-ARCHITECTURE.md)**

Implements PRD-D-02. Versions verified against the npm registry and nodejs.org on 2026-11-24; additions (`pixelmatch`, `pngjs`, `@types/pngjs`) and `firebase` were re-checked on 2026-11-25 with `npm view <pkg> version peerDependencies engines`. Where the registry `latest` is newer (`@biomejs/biome` 2.6.9, `react-router` 8.5.3, `typescript` 7.0.2) the verified version is kept (S2).

`SPEC-STACK-01`: pin **exact** versions in `package.json` (no `^`/`~`); commit `package-lock.json`; `npm ci` everywhere. An architecture test asserts no range specifiers (`SPEC-ARCH-06`).

## 2.1 Runtime and toolchain

| Item | Version | Why |
|---|---|---|
| Node.js | **26.13.1 LTS** | Build/test runtime; `.nvmrc` = `26`; `engines.node: ">=26"` |
| npm | bundled with Node 26 | One package manager |
| TypeScript | **6.0.3** | Project references (§3.4). 7.0.x drops the JS compiler API that dependency-cruiser needs (S3) |
| Vite | **8.3.8** | Dev server, static build, module workers |
| @vitejs/plugin-react | 6.3.0 | React transform (peer `vite ^8`) |
| tailwindcss + @tailwindcss/vite | 4.3.5 | Utility CSS, tokens via `@theme` (§5) |
| @biomejs/biome | 2.6.8 | Lint + format (no ESLint/Prettier, `SPEC-STACK-02`) |

## 2.2 Runtime dependencies

| Package | Version | Why |
|---|---|---|
| react, react-dom | 19.3.1 | UI |
| react-router | 8.5.2 (library mode, `BrowserRouter`) | Routes (§4.13); peer `react >=19.2.7` met |
| firebase | **13.4.0** (bundles `@firebase/ai` 3.1.0) | `firebase/app`, `firebase/ai`, `firebase/app-check`, `firebase/remote-config`. Hybrid needs >= 12.5.0 (PRD-D-11); `InferenceSource`, `InferenceMode`, `initializeDeviceModel`, `OnDeviceParams` confirmed in the 3.1.0 typings (§4.3.1) |
| zod | 4.6.7 | Validate model output, DOM snapshots, stored records, imports (§4.1) |
| idb | 8.0.4 | Typed IndexedDB wrapper (§4.6) |
| pixelmatch | **8.0.0** (published 2026-10-06; ESM, ships `index.d.ts`; `index.js` has no imports) | Region pixel diff with anti-aliasing detection (`includeAA:false`) and OKLab HyAB colour distance (§4.4). Its `pngjs` dependency is used only by its CLI, so the browser bundle stays dependency-free |
| workbox-window | 7.4.1 | Service worker registration/update (§4.13) |

No state library, no UI kit, no icon font (inline SVG), no analytics, no canvas/image library besides `pixelmatch` (decode/resize use browser `createImageBitmap` + `OffscreenCanvas`, §4.4).

## 2.3 Dev dependencies

| Package | Version | Why |
|---|---|---|
| vite-plugin-pwa | 2.0.0 | Manifest + `injectManifest` service worker |
| workbox-build, workbox-core, workbox-precaching, workbox-routing | 7.4.1 | Peer of the PWA plugin; bundled into `src/app/sw.ts` |
| vitest + @vitest/coverage-v8 | 5.1.1 | Unit, component, architecture tests |
| jsdom | 31.0.1 | DOM for component tests |
| @testing-library/react / @testing-library/dom | 16.3.3 / 10.4.2 | Component tests |
| fake-indexeddb | 6.2.8 | Storage tests in Node |
| pngjs | **7.0.0** (engines `node >=14.19`) | Decode committed sample PNGs in Node tests so the deterministic engine is tested without a browser (§7.4) |
| @types/pngjs | 6.0.5 | Types for the above |
| @playwright/test | 1.65.1 | E2E, PWA/offline, DOM-snippet runs, sample capture script (§4.11) |
| @axe-core/playwright | 4.14.0 | WCAG checks in E2E (PRD-M-11) |
| dependency-cruiser | 18.9.0 | Architecture enforcement (§3.5) |
| firebase-tools | 15.37.0 | Manual Hosting deploy (§8) |
| @types/react, @types/react-dom | 19.3.0 | React types |
| @types/node | 26.6.6 | Node types (tests, scripts) |
| @vite-pwa/assets-generator | 2.0.0 | PWA icons from `public/icon.svg` via `pwa-assets.config.ts` (`SPEC-PWA-01`); outputs committed |

## 2.4 Rules

| ID | Rule |
|---|---|
| `SPEC-STACK-02` | Lint/format = Biome; boundaries = dependency-cruiser + TS project references. Adding ESLint, a state library, a UI kit or an image library requires an `S#` entry. |
| `SPEC-STACK-03` | `pixelmatch` is imported only in `features/measure` (`SPEC-ARCH-05`). Its `threshold` semantics changed in v8 (OKLab HyAB); thresholds in §4.1.6 are tuned for 8.0.0 and pinned with it. |
| `SPEC-STACK-04` | Compatibility proof = `npm ci && npm run typecheck && npm run build && npm test` on a clean clone. Peer warnings are fixed by pinning, never `--force`/`--legacy-peer-deps`. |

## 2.5 Compatibility checks done

- Vite 8.3.8 ↔ plugin-react 6.3.0, @tailwindcss/vite 4.3.5, vite-plugin-pwa 2.0.0, Vitest 5.1.1: peer ranges include Vite 8.
- Node 26.13.1 satisfies engines of Vite, Vitest, jsdom, dependency-cruiser, react-router, pngjs.
- `firebase` 13.4.0 = registry `latest` on 2026-11-25; `@firebase/ai` 3.1.0 typings inspected (§4.3.1).
- pixelmatch 8.0.0 is `latest`, older than two weeks, no peer dependencies, no engines constraint.
