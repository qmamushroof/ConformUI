# 6. Security, Privacy, Performance

**[◀ 5. UI](05-UI.md)** · [SPEC index](../SPEC.md) · **[7. Testing Strategy ▶](07-TESTING-STRATEGY.md)**

## 6.1 Privacy and data flow (PRD-P-05, PRD-P-11, PRD §6 privacy statement)

| ID | Rule |
|---|---|
| `SPEC-SEC-01` | Inventory: (a) device only: Projects, images (normalised PNG), DOM snapshots, Contracts, Runs, settings (IndexedDB); (b) to Google via Firebase AI Logic only after Project consent or a Deep Analysis Send: the listed images, prompt text, Contract and measurements, plus App Check token and Firebase installation id; (c) nothing to any other party. No analytics, no cookies set by the app. |
| `SPEC-SEC-02` | No cloud-capable `AiMode` without a consent token (`SPEC-AI-02`), and the token can only be minted from a trusted click (`mintConsent`). E2E network spy: zero requests to `firebasevertexai.googleapis.com` before Allow/Send in every scenario (PRD-M-06). |
| `SPEC-SEC-03` | Snapshot URL stored as origin + pathname only (`SPEC-SNIP-07`); snippet never reads form values, cookies or storage (PRD-D-24). |
| `SPEC-SEC-04` | `console.*` banned in `src/` (Biome) except `console.warn/error` with fixed text + `CuiError.code`; no user content in logs, URLs or error screens. |
| `SPEC-SEC-05` | AI monitoring off by default in the console (owner step, §8.3); privacy copy states Gemini Developer API data handling (link to terms) (PRD-D-26). |

## 6.2 Application security

| ID | Rule |
|---|---|
| `SPEC-SEC-06` | Untrusted model output and page text (snapshot names/text) are rendered as React text only; no `dangerouslySetInnerHTML` anywhere (Biome rule). URLs from snapshots are shown as text, never links. |
| `SPEC-SEC-07` | Prompt injection (PRD-R-10): image text and snapshot text are wrapped as data (`<<<DATA … DATA>>>`) and prompts state they are not instructions; output constrained by schema + zod; no tools enabled; numbers guarded (`SPEC-KERNEL-08`); AI cannot change Measured statuses or severity floors. |
| `SPEC-SEC-08` | CSP (Hosting headers): `default-src 'self'; script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src https://www.google.com/recaptcha/; connect-src 'self' data: https://firebasevertexai.googleapis.com https://firebaseremoteconfig.googleapis.com https://firebaseinstallations.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.google.com; object-src 'none'; base-uri 'none'; form-action 'self'`. `data:` in `connect-src` is required: the SDK's on-device path fetches `data:` URLs to build image parts. `'unsafe-inline'` styles only if React inline `style` for crop positioning needs it (try without first). Exact origins: VERIFY spike D1 (Network tab, zero CSP violations in E2E against preview, plus one real on-device image prompt on the CSP-enforced preview). Plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. |
| `SPEC-SEC-09` | Abuse/cost (PRD-R-07): App Check enforced for AI Logic; API key restricted by HTTP referrer to Hosting domains + `http://localhost:5173`; budget alert and AI Logic quota (owner steps); `cloud_enabled` kill switch and `deep_daily_cap` via Remote Config. |
| `SPEC-SEC-10` | Supply chain: exact pins, `npm ci`, `npm audit --omit=dev --audit-level=high` in CI, Dependabot (npm, actions). |
| `SPEC-SEC-11` | Secrets: none in the repo. `VITE_*` are public config; reCAPTCHA key is a site key; App Check debug tokens only in `.env.local` (git-ignored). |
| `SPEC-SEC-12` | Imports: pasted JSON (snapshots, [P1] contract import) is size-capped before `JSON.parse` and zod-validated; no `eval`, no `Function`. The snippet is shown for copying only; the app never executes it. |

## 6.3 Performance budgets (`SPEC-PERF-*`, demo-grade)

| ID | Budget | Condition |
|---|---|---|
| `SPEC-PERF-01` | Deterministic stages of the sample Run (2 viewports) ≤ 3 s (PRD-F-04.4, PRD-M-08) | desktop Chrome, mid-range laptop; trace durations |
| `SPEC-PERF-02` | On-device Contract extraction of the sample design < 60 s (PRD-M-08, VERIFY on demo hardware) | model ready, warm |
| `SPEC-PERF-03` | Image add (normalise + store) ≤ 1.5 s for a 1440×4000 PNG | — |
| `SPEC-PERF-04` | Initial JS (route `/`, gzip) ≤ 170 KB excluding lazy `firebase/*` chunk; `firebase/*` via dynamic `import()` after first paint; total JS gzip ≤ 450 KB; CSS ≤ 25 KB | `scripts/check-size.mjs` in CI (blocking) |
| `SPEC-PERF-06` | Offline second visit: app shell interactive ≤ 1 s | Playwright `setOffline(true)` |
| `SPEC-PERF-07` | Lighthouse (manual DevTools run before submission): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, installable | deployed URL, advisory and optional (may be skipped under the ROADMAP cut list; scores reported in README when run) |

`SPEC-PERF-05` is retired (measure Worker dropped, S22); the ID is not reused.

`SPEC-PERF-08`: long work shows progress within 100 ms; buttons that start work set `aria-busy` and ignore repeat clicks.
