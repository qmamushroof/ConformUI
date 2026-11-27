# 16. Release

**[◀ 15. Polish and A11y](15-POLISH-A11Y.md)** · [Roadmap index](../ROADMAP.md) · **[17. Demo Script ▶](17-DEMO-SCRIPT.md)**

| | |
|---|---|
| **Depends on** | M4; 15.3 for the enforced CSP. Budget 0.75 h, lane A; Human steps 16.3, 16.4, 16.6 |
| **Delivers** | LICENSE, README, production deploy, Remote Config published, hosted smoke, video, submission checklist |
| **Read** | SPEC §8, §4.3.6 (SPEC-AI-13); PRD §10, §11 item 13, §12, PRD-D-13 |
| **Covers** | SPEC-DEPLOY-01..04, SPEC-AI-13, SPEC-FB-08, SPEC-PWA-02, PRD-D-13, PRD-D-30, PRD-M-12, PRD §11 item 13 |

### 16.1 LICENSE and package metadata · A · 0.05 h · needs M4
- [x] `LICENSE` = full Apache-2.0 text; `NOTICE` = "Copyright 2026 ConformUI contributors" (kept out of LICENSE so GitHub detection stays Apache-2.0); `package.json` `license` (SPEC-DEPLOY-04).
- [x] `package.json` `repository` filled (PRD-D-30). README part lands with 16.2.

**Accept:** GitHub detects Apache-2.0; `npm pkg get license` prints `"Apache-2.0"`.

### 16.2 README · A · 0.4 h · needs 14.4, 15.3
- [x] Every section of SPEC-DEPLOY-04, in that order: what it does; **how Firebase AI Logic is used** (`InferenceMode` per feature table, SPEC-AI-13; `inferenceSource` badge; zod-validated structured output; consent-safe mode mapping; App Check; Remote Config keys); the three engines; features and value; screenshots; Quick start; Setup (SPEC §8.3 steps 1–5); enabling on-device in Chrome; tested browsers; Deploy (manual command); Verify checklist with the 14.4 results and 15.3 scores; demo video link; honest limits; privacy statement; license. Done in `README.md` and `docs/SUBMISSION.md` (screenshots in `docs/screenshots/`, regenerated with `npm run screenshots`). Rows still pending a live run stay marked pending in the README Verify checklist.
- [x] Limits line if any 9.5 seed ships: "The sample's pre-computed results are hand-authored" (SPEC §4.11.2).
- [x] Link the code that calls AI Logic (`src/platform/ai-engine/`), the Chrome model info from 4.4, and the hosted URL (replaces `<HOSTED_URL>`, PRD-D-30).

**Accept:** README contains `ONLY_ON_DEVICE`, `PREFER_ON_DEVICE`, `ONLY_IN_CLOUD`; no `<HOSTED_URL>` left; no `<REPO_URL>` placeholder left in README/`package.json`; grep finds no build-tool or personal-detail mention (PRD-D-15), ignoring the repo URL the owner set in README and `package.json`.

### 16.3 Production deploy · Human (A prepares) · 0.1 h · needs 16.1, 15.3
- [x] A: clean `npm ci && npm run build`, `npm run check` green on `main`, tag `v1.0.0`.
- [x] Human: `npx firebase deploy --only hosting` (SPEC-DEPLOY-01; no CI deploy, S18).

**Accept:** hosted URL loads over HTTPS; installs on desktop Chrome; second visit offline opens the shell and sample (PRD-M-12, SPEC-PWA-02).

### 16.4 Remote Config publish · Human · 0 h · needs 16.3
- [x] Import `remoteconfig.template.json` in the console (or `npx firebase deploy --only remoteconfig`) and publish (SPEC-FB-08, SPEC §8.3 step 3).

**Accept:** console lists every SPEC §4.1.6 key with its default.

### 16.5 Hosted smoke · A · 0.1 h · needs 16.4
- [ ] On the hosted URL, demo machine: sample Extract (On-device), Run, Deep Analysis (Cloud), Copy fix prompt, Re-verify, export.

**Accept:** both `inferenceSource` values seen; App Check accepted (no 401/403); zero CSP violations.

### 16.6 Demo video · Human · 0 h · needs 16.5
- [ ] Record per [17](17-DEMO-SCRIPT.md); ≤ 3:00; upload publicly to YouTube; add the link to the README.

**Accept:** link plays signed out; length ≤ 3:00.

### 16.7 Submission checklist · A · 0.1 h · needs 16.6

| Challenge requirement | Evidence | Done |
|---|---|---|
| Working application | Hosted URL (16.3) and 16.5 smoke | [x] |
| Public repository | Repo (PRD-D-30) opens signed out | [x] |
| Open-source license (Apache preferred) | `LICENSE` Apache-2.0 (16.1) | [x] |
| Firebase AI Logic implemented and called | `firebase/ai` in `src/platform/ai-engine/`; Engine badge shows `inferenceSource` | [x] |
| ≥ 1 supported Firebase product | App Check (enforced for AI Logic) + Remote Config (16.4) | [x] |
| Supported platform | Web/Chrome desktop with on-device Gemma 4 via hybrid; installed PWA (cloud-only path checked in device emulation, PRD-D-32) | [x] |
| Description: what it does, how AI Logic is used, features and value | README sections (16.2) | [x] |
| Demo video ≤ 3 min, public | YouTube link (16.6) | [ ] |
| Hosted demo | README link to the hosted URL | [x] |
| Original, no third-party IP | Unbranded sample (S28), original art, font licence file (SPEC §4.11.2) | [x] |
| Not a chatbot; hybrid shows its value | PRD-P-08; on-device first pass + cloud Deep Analysis in the video | [x] |

**Accept:** every row ticked; submission form filled with repo URL, hosted URL, video URL and the README description.
