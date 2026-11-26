# 2. Human Setup

**[◀ 1. Plan and Budget](01-PLAN-BUDGET.md)** · [Roadmap index](../ROADMAP.md) · **[3. Step 0: Kernel Freeze ▶](03-KERNEL-FREEZE.md)**

| | |
|---|---|
| **Depends on** | Nothing; runs beside Day 1. 2.5 needs 5.1; 2.10 needs 3.7 |
| **Owner** | Human (owner). 0 agent-hours; the agent stops and asks |
| **Read** | SPEC §8.2, §8.3, §4.2.2, §6.2 (SPEC-SEC-09) |
| **Covers** | SPEC-DEPLOY-01, SPEC-DEPLOY-02 (values), SPEC-FB-03..05, SPEC-SEC-05, SPEC-SEC-09, SPEC-SEC-11 |

Public web config goes to `.env.local` (git-ignored). CI needs no secret (SPEC-DEPLOY-03).

## Steps

- [x] **2.1** Human: confirm the repo (PRD-D-30) is public and the agent can push branches. Verify: repo page opens signed out.
- [x] **2.2** Human: create the Firebase project; Console > AI Logic > **Gemini Developer API** (PRD-D-26); AI monitoring off (SPEC-SEC-05). Verify: AI Logic page shows the API enabled.
- [x] **2.3** Human: register a Web app; put the five `VITE_FIREBASE_*` values in `.env.local` (SPEC-DEPLOY-02); put the project id in `.firebaserc`. Verify: `npm run dev` passes env validation (after 7.1).
- [x] **2.4** Human: create a score-based reCAPTCHA Enterprise **Web** key for the Hosting domains (`<project>.web.app`, `<project>.firebaseapp.com`; not `localhost`); register it in App Check; set `VITE_RECAPTCHA_ENTERPRISE_KEY`; enforce App Check for AI Logic (SPEC-FB-03, SPEC-FB-05). The Hosting preview-channel host is added later, in 15.3 (SPEC §8.3 step 2). Verify: App Check lists the Web app as enforced for AI Logic.
- [x] **2.5** Human: generate a debug token in the console (App Check > Manage debug tokens > Generate; this can be done up front instead of reading it from the dev console after 5.1 exists), keep it only in `.env.local` (SPEC-FB-04). Verify: a cloud call from 4.4 returns no 401/403 (checked in 4.4).
- [x] **2.6** Human: API-key HTTP-referrer restriction to Hosting domains + `http://localhost:5173` (SPEC-SEC-09). AI Logic quota: default per-user limit (100 requests/min) kept; budget alert not applicable on Spark plan (no billing account linked) — set both if upgraded to Blaze. Verify: console shows the referrer restriction.
- [x] **2.7** Human: enable Hosting; `npx firebase login` on the dev machine (SPEC-DEPLOY-01). Verify: `npx firebase projects:list` shows the project.
- [ ] **2.8** Human: demo machine: desktop Chrome ≥ 139 meeting the on-device hardware needs; enable `chrome://flags/#prompt-api-multimodal-input`; relaunch; start the model download from a page action. Note the Chrome version for the README. Verify: DevTools `await LanguageModel.availability()` returns `"available"`. Status: desktop Chrome latest, 64 GB RAM, ample disk confirmed; model download and `availability()` check pending.
- [x] ~~**2.9** Human: Android phone with current Chrome for the install and cloud beat (PRD-M-12, PRD §10). Verify: phone opens an HTTPS page.~~ Dropped (PRD-D-32): no Android device; mobile is checked with desktop Chrome DevTools device emulation and install is verified on desktop Chrome only.
- [x] **2.10** Human: after 3.7, protect `main` with the `ci` check required (SPEC-DEPLOY-03). Verify: a red PR cannot merge.

Day 3 human steps live in [16](16-RELEASE.md): 16.3 deploy, 16.4 Remote Config publish, 16.6 video.

## Exit gate

- 2.1–2.5 and 2.8 done before 4.2 (live spikes). 2.6–2.7 before 15.3. 2.9 dropped (PRD-D-32).
- `.env.local` complete and git-ignored; no token or key committed (SPEC-SEC-11).
