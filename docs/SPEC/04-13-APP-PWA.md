# 4.13 app shell + PWA

**[◀ 4.12 settings](04-12-SETTINGS.md)** · [SPEC index](../SPEC.md) · **[5. UI ▶](05-UI.md)**

`src/app`: composition root, routes, layout, service worker, manifest. The only module importing every other module (`SPEC-ARCH-01`). Realises PRD-F-12, PRD-D-02, PRD-D-08, PRD-D-31.

## 4.13.1 Composition (`SPEC-APP-01`)

`app/compose.ts`: `openStorage()` → `createImageCodec()` → `inlineMeasureClient()` (no Worker in release 1, S22) → services that need no Firebase (`projects`, `contract`, `run`, `deep`, `settings`) with a **lazy** `AiEngine` proxy → after first paint, dynamic `import('@fb')` + `import('@ai')` → `initFirebase(env)` → `createAiEngine` resolves the proxy (calls before resolution await it; status before resolution = `unavailable/unknown`). `<ServicesProvider>` (React context in `app`) provides services; features get them as props from route components. `composeForTest()` uses `FakeAiEngine`, `fake-indexeddb` and `inlineMeasureClient()`. With `VITE_E2E` the app's compose **skips `@fb`/`@ai` entirely**: `AiEngine` = `FakeAiEngine`, `RuntimeConfig` = static kernel `DEFAULT_RUNTIME_VALUES`, and env validation does not require the Firebase variables (`SPEC-APP-06`). Cross-feature flows (consent sheet → contract/run, Run → Deep → export) are wired here. `app` calls `ProjectsService.recordCloudUsage(projectId, step.bytesSent)` for every `TraceStep` with engine `cloud` (extract, run, deep) and sets `everSentToCloud`.

## 4.13.2 Routes (react-router library mode, `BrowserRouter`; Hosting rewrite `** → /index.html`)

| Path | Screen | Notes |
|---|---|---|
| `/` | Projects | redirects to `/welcome` until onboarded |
| `/welcome` | Onboarding | `SPEC-SET-08` |
| `/p/:projectId` | Project: inputs per viewport, contract summary, run history, primary next action | `SPEC-PROJ-*` |
| `/p/:projectId/contract` | Contract review | `SPEC-CON-*` |
| `/p/:projectId/run/:runId` | Run: findings, comparison, trace, deep, exports; `?f=<findingId>` selects a Finding | `SPEC-RUN-*` |
| `/snippet` | DOM snippet + instructions | `SPEC-SNIP-*` |
| `/settings` | Engine panel, mode, consents, privacy, clear data | `SPEC-SET-*` |
| `*` | Not found | link home |

`SPEC-APP-02`: header on every route: logo + "ConformUI", Engine status pill (On-device ready / Cloud with consent / Measured only), `PrivacyCounter`, nav (Projects, Snippet, Settings), "Offline" pill when offline. Routes lazy-loaded except `/`.
`SPEC-APP-03`: `openStorage()` rejection → full-screen `StateNotice` `STORAGE_UNAVAILABLE` + Reload; no services are composed. An error boundary per route shows a plain-language screen with Reload; unhandled rejections map through `CuiError` to `StateNotice` (§5.4); no user content in logs.

## 4.13.3 Manifest and icons (`vite-plugin-pwa`, `strategies: 'injectManifest'`, `registerType: 'prompt'`)

| Field | Value |
|---|---|
| `id`, `start_url`, `scope` | `/` |
| `name` / `short_name` | `ConformUI: design acceptance testing` / `ConformUI` |
| `display`, `lang`, `categories` | `standalone`, `en`, `["developer","productivity","utilities"]` |
| `theme_color` / `background_color` | `#2563EB` / `#FFFFFF` |
| `icons` | 192/512 PNG `any`, 512 `maskable`, apple-touch 180 from `public/icon.svg`; `favicon.ico` (16, 32) + `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` from `public/favicon.svg` (`SPEC-PWA-01`); outputs committed |
| `share_target` | [P1] `{ action: '/share-target', method: 'POST', enctype: 'multipart/form-data', params: { files: [{ name: 'image', accept: ['image/png','image/jpeg','image/webp'] }] } }` |

`SPEC-PWA-01` (PRD-D-31): two owner sources, nothing else. Icons rendered at **48 px and above** derive from `docs/brand/logo.svg`, copied unchanged to `public/icon.svg`; icons **below 48 px** derive from `docs/brand/favicon.svg` (same mark, 16 px grid, 1 px stroke), copied unchanged to `public/favicon.svg`. `pwa-assets.config.ts` (`@vite-pwa/assets-generator`, `npm run icons`): from `icon.svg` → 192/512 `any`, apple-touch 180, and 512 `maskable` with `maskable: { padding: 0.2, resizeOptions: { background: '#FFFFFF' } }`; from `favicon.svg` → `favicon.ico` with 16 and 32 px (if the generator emits only one ico size, use 32; check at build). Maskable safe zone: in `logo.svg` the mark spans 11–53 of 64 (paths 12–52, stroke 2), half-extent 21/64; padding 0.2 scales it to ≤ 0.8, so its corners sit at 21 × 0.8 × √2 ≈ 23.8/64 ≈ 37 % from centre, inside the 40 %-radius safe circle. The in-app header uses `icon.svg` inline with stroke mapped to token `accent`.

`SPEC-PWA-02`: install criteria per Chrome (manifest, icons, HTTPS, service worker); `beforeinstallprompt` captured → "Install app" button in header/settings; README documents install on desktop Chrome; Android install is not device-verified (PRD-D-32) (PRD-F-12.1, PRD-M-12).

## 4.13.4 Service worker (`src/app/sw.ts`, Workbox)

| ID | Rule |
|---|---|
| `SPEC-PWA-03` | Precache the build (`self.__WB_MANIFEST`) including lazy chunks, sample assets and the self-hosted fonts (§2.2, §5.2): the app imports only `@fontsource/ibm-plex-sans/latin-{400,500,600}.css` and `@fontsource/ibm-plex-mono/latin-{400,500}.css`; `injectManifest.globPatterns` = `['**/*.{js,css,html,woff2,png,svg,webp}']` (no `woff`: the Latin CSS also references `.woff` fallbacks, which are excluded from the precache); test: the precache manifest lists exactly 5 `.woff2` font files (`maximumFileSizeToCacheInBytes` 3 MiB); `NavigationRoute` → `index.html` (denylist `/share-target`). App shell + sample open offline (PRD-F-12.1, PRD-D-08). |
| `SPEC-PWA-04` | Never cache cross-origin requests (`*.googleapis.com`, `firebaseinstallations`, `content-firebaseappcheck`, `recaptcha`, `gstatic`). AI traffic is network-only. |
| `SPEC-PWA-05` | Update: `workbox-window` `waiting` → toast "A new version is ready." + Reload; `skipWaiting` only on that click. |
| `SPEC-PWA-06` | [P1] Share target (PRD-F-12.3, PRD-F-02.5): `POST /share-target` → read first `image` file → put in Cache `cui-share-inbox` under `/__share/<uuid>` → `303` redirect to `/?share=<uuid>`; the page reads + deletes it and opens "Add capture" prefilled; entries older than 10 min are swept at start. |

## 4.13.5 Other

- `SPEC-APP-04`: `<html lang="en">`; two `theme-color` metas (light `#FFFFFF`, dark `#0A0C10` = `bg` dark, `oklch(15.5% 0.009 260)`); `document.title` per route ("Run · <project> · ConformUI").
- `SPEC-APP-05`: no analytics, no third-party scripts beyond Firebase SDK and reCAPTCHA Enterprise (PRD-P-11).
- `SPEC-APP-06`: `app/env.ts` validates `VITE_*` with zod (§8.2): dev throws, prod shows "Configuration error" (deterministic engine still usable for the sample). With `VITE_E2E=1` the Firebase variables are optional.
