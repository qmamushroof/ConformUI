# 8. Deploy

**[◀ 7. Testing Strategy](07-TESTING-STRATEGY.md)** · [SPEC index](../SPEC.md) · **[9. Decisions ▶](09-DECISIONS.md)**

Realises PRD-D-02, PRD-D-13, PRD-D-30.

## 8.1 Hosting (`SPEC-DEPLOY-01`)

Firebase Hosting, one site, `public: "dist"`. Hosted URL = the Hosting default domain (`https://<project-id>.web.app`), recorded in README as `<HOSTED_URL>` once setup is done (PRD-D-30).

| Setting | Value |
|---|---|
| `rewrites` | `{ "source": "**", "destination": "/index.html" }` |
| `remoteconfig` | `{ "template": "remoteconfig.template.json" }` (enables `firebase deploy --only remoteconfig`) |
| `headers` | `/sw.js`, `/manifest.webmanifest`: `Cache-Control: no-cache`; `/assets/**`: `public, max-age=31536000, immutable`; all: CSP + security headers (`SPEC-SEC-08`) |
| Deploy | manual, from a developer machine: `npm ci && npm run build && npx firebase deploy --only hosting` (owner logged in with `firebase login`) |
| Preview (optional) | `npx firebase hosting:channel:deploy preview --expires 7d` (CSP spike D1) |

## 8.2 Environment (`SPEC-DEPLOY-02`)

| Variable (`.env.example` committed, `.env.local` git-ignored) | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID`, `_MESSAGING_SENDER_ID` | Firebase web config (public; key restricted by referrer) |
| `VITE_RECAPTCHA_ENTERPRISE_KEY` | App Check site key |
| `VITE_APPCHECK_DEBUG`, `VITE_APPCHECK_DEBUG_TOKEN` | dev only (`SPEC-FB-04`) |
| `VITE_E2E` | e2e build only (`SPEC-TEST-01`) |
| `VITE_APP_VERSION` | git tag/sha injected at build |

One Firebase project (production + preview channels). `app/env.ts` validates with zod (`SPEC-APP-06`).

## 8.3 One-time console steps (owner; README "Setup")

1. Create the Firebase project; enable **AI Logic** with the **Gemini Developer API** (PRD-D-26); keep AI monitoring off (`SPEC-SEC-05`).
2. Register the Web app; create a score-based reCAPTCHA Enterprise Web key for the Hosting domains; register it in App Check; enforce App Check for AI Logic; register dev debug tokens before first run (`SPEC-FB-05`). Add each Hosting preview-channel host (`<project>--<channel>-<hash>.web.app`) to the reCAPTCHA key domains and API-key referrers before testing on it.
3. Publish Remote Config manually from `remoteconfig.template.json` (console import, or `npx firebase deploy --only remoteconfig`) (`SPEC-FB-08`).
4. API-key referrer restriction (`SPEC-SEC-09`). On the Spark plan the default AI Logic per-user quota is kept and no budget alert applies; set both if upgraded to Blaze.
5. Fill `<HOSTED_URL>` in README after the first deploy.

## 8.4 CI (GitHub Actions, `SPEC-DEPLOY-03`)

One workflow, `.github/workflows/ci.yml`, on pull requests and pushes to `main`: Node 26 → `npm ci` → `biome ci` → `tsc -b` → `depcruise` + architecture tests → `vitest run` → `vite build` + size check → `npx playwright install --with-deps chromium` → e2e build + Playwright → `npm audit --omit=dev --audit-level=high`; Playwright report uploaded on failure. Required check on `main`: `ci`. CI needs no secrets (E2E uses `FakeAiEngine`, `SPEC-APP-01`). No deploy workflow, no Lighthouse CI in release 1 (S18): deploy is the manual command in §8.1, documented in README. Dependabot weekly (npm, github-actions). TypeScript major updates are ignored (S3).

## 8.5 License, repo, README (`SPEC-DEPLOY-04`, PRD-D-13, PRD-D-30)

- Repo: `<REPO_URL>` (PRD-D-30) (public). `LICENSE` = Apache-2.0 full text, "Copyright 2026 ConformUI contributors"; `package.json` `"license": "Apache-2.0"`, `"repository"` = repo URL.
- README sections: what it does; **how Firebase AI Logic is used** (hybrid modes table per feature `SPEC-AI-13`, `inferenceSource` badge, structured output with zod, consent-safe mode mapping, App Check, Remote Config keys); the three engines; features and value; screenshots; Quick start (`npm ci`, `.env.local`, `npm run dev`); enabling on-device in Chrome (flag steps, Download model); tested browsers; Deploy (§8.1 command); Verify checklist (§7.1 manual smoke) with recorded results (PRD-M-07, PRD-M-08, PRD-M-14); demo video link; honest limits (on-device = desktop Chrome only; Android uses cloud; on-device limits; model version chosen by Chrome); privacy statement; license.
- `.gitignore`: `node_modules`, `dist`, `.env*` (except `.env.example`), `playwright-report`, `test-results`, `.firebase`.
