# Development Machine Setup

How to set up a new development machine (Windows, macOS or Linux) and the one-time cloud and browser setup, so you can work on ConformUI from any device. *What*: `docs/PRD.md`. *How*: `docs/SPEC.md` (§8 Deploy). Sequencing: [ROADMAP/02-HUMAN-SETUP.md](ROADMAP/02-HUMAN-SETUP.md).

Sections: [A Developer machine](#a-developer-machine) · [B Firebase and Google Cloud (one time)](#b-firebase-and-google-cloud-one-time) · [C Desktop Chrome for on-device AI](#c-desktop-chrome-for-on-device-ai) · [D Live VERIFY spikes](#d-live-verify-spikes) · [E Working in parallel](#e-working-in-parallel) · [F Troubleshooting](#f-troubleshooting)

Paths below use `~` for your home directory and `%LOCALAPPDATA%` for the Windows per-user app folder. Never commit keys, tokens or `.env.local` (SPEC-SEC-11).

## A. Developer machine

1. **Git and GitHub CLI.** Install Git and the GitHub CLI (`gh`). Run `gh auth login` (HTTPS, sign in through the browser). Clone the repository: `gh repo clone <owner>/ConformUI`. Verify: `git status` is clean and `gh auth status` shows you signed in.
2. **Node.js 26.** The repo requires `>=26` and `.nvmrc` is `26`. Node 24 makes Vitest fail with `Cannot read properties of undefined (reading 'config')`. Pick one option:
   - **Official installer or zip** from nodejs.org. For the zip, verify its SHA256 against `SHASUMS256.txt` from the same release folder, extract it (for example under `%LOCALAPPDATA%\Programs` on Windows) and put that folder on `PATH`.
   - **Version manager**: nvm-windows (Windows), nvm (macOS/Linux) or fnm. Run `nvm install 26` then `nvm use 26`, or `fnm use` (fnm reads `.nvmrc`; nvm on macOS/Linux also does with a bare `nvm use`).

   Restart the editor and every terminal so `PATH` is re-read. Verify: `node -v` prints `v26.x` and `npm -v` prints `11.x`.
3. **Install dependencies:** `npm ci` (not `npm install`; it keeps `package-lock.json` exact). npm 11 may print `npm warn install-scripts` for packages whose install scripts it skips. That is fine here (the hosting CLI's native module still loads). Do not run the suggested approve commands: they rewrite `package.json`. Verify: `npm ci` exits 0.
4. **Playwright browser:** `npx playwright install chromium`. CI uses `npx playwright install --with-deps chromium`; use that form on a fresh Linux machine. Verify: `npx playwright --version` prints a version.
5. **Verify the toolchain.**
   - `npm run check:fast` = `lint` (Biome) + `typecheck` (`tsc -b`) + `depcruise` (dependency rules) + `test` (Vitest unit, component and architecture tests).
   - `npm run check` = `check:fast` + `build` + `check:size` (bundle budget) + `check:dist` (built-output rules) + `test:e2e` (Playwright against the `--mode e2e` build on port 4173; fake AI only).
   - `E2E_PORT` (optional, default 4173) sets the port of the Playwright preview server, so parallel local runs do not collide: `E2E_PORT=4519 npm run test:e2e`.
   - Others: `build:e2e` (E2E build), `icons` (regenerate PWA icons), `sample:capture` (re-capture the sample site).

   Verify: `npm run check:fast` is green. Run `npm run check` before a PR that touches the app.
6. **`.env.local`** (git-ignored; each machine needs its own; SPEC-DEPLOY-02). Copy `.env.example` to `.env.local` and fill:

   | Variable | Where it comes from |
   |---|---|
   | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase console > Project settings > General > Your apps > Web app > SDK setup and configuration |
   | `VITE_RECAPTCHA_ENTERPRISE_KEY` | The reCAPTCHA Enterprise key id (B3): Google Cloud console > Security > Fraud Defense (reCAPTCHA) > Key management |
   | `VITE_APPCHECK_DEBUG` | `1` on a dev machine (SPEC-FB-04) |
   | `VITE_APPCHECK_DEBUG_TOKEN` | Generated in the console (B4) |
   | `VITE_E2E`, `VITE_APP_VERSION` | Leave blank. Set automatically by `--mode e2e` and by the build (git sha) |

   Preferred: one debug token per machine, revoked when you retire that machine (reusing the same token also works). Verify: `npm run dev` passes env validation and shows no error screen.
7. **Firebase CLI.** Run `npx firebase login`. Answer `n` to the optional Gemini-in-Firebase and usage-collection prompts. With no browser on the machine use `npx firebase login --no-localhost`. Verify: `npx firebase projects:list` shows `conformui` (the `.firebaserc` default).
8. **Run the app.** `npm run dev` serves http://localhost:5173. The port matters: the API key's referrer allow-list contains `http://localhost:5173/*` (SPEC-SEC-09), so cloud AI calls fail on any other port. `npm run build` builds `dist/`; `npm run preview` serves it. Verify: the app loads at http://localhost:5173.

## B. Firebase and Google Cloud (one time)

Already done for project `conformui`. Follow this only for reference or to rebuild on a fresh project. It mirrors ROADMAP 2.2–2.7 and 2.10 (SPEC §8.3). `<id>` is the project id.

1. **Project and AI Logic (2.2).** Create the Firebase project. Console > AI Logic > Get started > **Gemini Developer API** (PRD-D-26). Leave AI monitoring off (SPEC-SEC-05). Verify: the AI Logic page shows the API enabled.
2. **Web app (2.3).** Console > Project settings > General > Your apps > add a Web app. Copy its config into `.env.local` (A6) and set the project id in `.firebaserc`. Verify: `npm run dev` passes env validation.
3. **reCAPTCHA Enterprise key (2.4).** Create it in the **Google Cloud console under Security > Fraud Defense (reCAPTCHA) > Key management** (`https://console.cloud.google.com/security/recaptcha?project=<id>`). Do **not** use APIs & Services > Credentials: that creates a plain API key, which is wrong here. Settings: platform **Web**, domains `<id>.web.app` and `<id>.firebaseapp.com`, no `localhost`, checkbox challenge off (score-based). Then Firebase console > App Check > Apps > the web app > **reCAPTCHA Enterprise** > paste the key id (SPEC-FB-03), and put the same id in `VITE_RECAPTCHA_ENTERPRISE_KEY`. Enforce App Check for Firebase AI Logic (App Check > APIs tab); leave Remote Config not enforced (SPEC-FB-05). Verify: App Check lists the web app as enforced for AI Logic.
4. **Debug token (2.5).** App Check > Apps > the web app > ⋮ > **Manage debug tokens** > Add > Generate. Paste it into `.env.local` as `VITE_APPCHECK_DEBUG_TOKEN` and set `VITE_APPCHECK_DEBUG=1` (SPEC-FB-04). Verify: a cloud call returns no 401/403.
5. **API key restriction (2.6, SPEC-SEC-09).** Google Cloud console > APIs & Services > Credentials > **Browser key (auto created by Firebase)** > Application restrictions > Websites: `https://<id>.web.app/*`, `https://<id>.firebaseapp.com/*`, `http://localhost:5173/*`. Leave API restrictions as Firebase set them: narrowing them breaks AI Logic, App Check and Remote Config. Verify: the console shows the referrer list.
6. **Quota and budget (2.6).** On the Spark (no-cost) plan no billing account is linked, so no budget alert is possible and the default Firebase AI Logic per-user quota (100 requests/min) is kept. If the project is upgraded to Blaze, set a budget alert and lower the quotas at `https://console.cloud.google.com/apis/api/firebasevertexai.googleapis.com/quotas?project=<id>` (rows are per region; the "Bidi generate content" rows are the live API, which is unused).
7. **Hosting (2.7).** Console > Hosting > Get started. Skip its CLI steps: `firebase.json` already exists. Deploys are manual (ROADMAP 16.3). Verify: `npx firebase projects:list` shows the project (A7).
8. **GitHub ruleset (2.10, SPEC-DEPLOY-03).** Repo > Settings > Rules > Rulesets > new branch ruleset "main protection" on the default branch: require a pull request, require the status check `ci`, block deletion, block force-push. Verify: a red PR cannot merge.

## C. Desktop Chrome for on-device AI

Needed only on the demo machine (ROADMAP 2.8).

1. **Chrome ≥ 139**, 64-bit desktop (verified on 158.0.8127.x, Windows). Open `chrome://on-device-internals` > Broker State to see the install criteria: ≥ 3000 MiB VRAM, ≥ 20480 MiB free disk to install, ≥ 5120 MiB to retain. The verified machine reported performance class High.
2. **Flags** (`chrome://flags`), then Relaunch:
   - `#prompt-api-multimodal-input` (older name: `#prompt-api-for-gemini-nano-multimodal-input`): Enabled.
   - `#gemma4-for-built-in-ai` ("Gemma 4 for Built-in AI"): Enabled. Required: the product uses the Gemma 4 on-device model (PRD-D-33). Chrome's default Gemini Nano v3 may remain installed; that is fine, Chrome uses Gemma 4 once this flag is on and the model is downloaded.
   - "Decisions API" and "Multi-Token Prediction": leave at Default.
3. **Start the model download.** It needs a user click on a page. Open https://example.com, open DevTools > Console (type `allow pasting` if Chrome asks), paste the snippet, then click the page content (not the console):

   ```js
   document.addEventListener('click', async () => {
     console.log('starting…');
     try {
       const s = await LanguageModel.create({
         expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
         expectedOutputs: [{ type: 'text', languages: ['en'] }],
         monitor(m) { m.addEventListener('downloadprogress', e => console.log('download', Math.round(e.loaded * 100) + '%')); }
       });
       console.log('ready', s);
     } catch (e) { console.error('create failed:', e.name, e.message); }
   }, { once: true });
   ```

   Attaching to `document.body.onclick` can miss clicks on short pages. Chrome warns if no output language is given (supported: de, en, es, fr, ja).
4. **Verify.** Console: `await LanguageModel.availability({ expectedInputs: [{ type: 'image' }] })` returns `'available'`. In `chrome://on-device-internals` > Broker State > Assets, the model component shows "Ready". Components seen: Gemini Nano v3 `nano_v3_gpu` (about 4 GB); Gemma 4 `gemma4_component`, `gemma4_4b_component`, `gemma4_12b_component` (use cases `prompt_api_gemma4*`). The Prompt API has no model-selection parameter and no API reports which model answered: confirm through the Event Logs (above); `contextWindow` is 9216 on both Nano v3 and Gemma 4, so it does not distinguish them. To prove which model answers: open `chrome://on-device-internals` > Event Logs BEFORE prompting, then run a prompt. Expected log lines: "Loading model [gemma4_gpu_high_tier_model] on backend [GPU]" and "Model generates text response with PromptApi". Broker State shows use case `prompt_api_gemma4` Requested + Available. Chrome picks the variant (`gemma4_4b`/`gemma4_12b` can stay "Pending Usage"); a page cannot. The "Tools" tab message "Unable to load model … /tmp/model" belongs to a manual model loader; ignore it.
5. **Mobile.** Android device testing was dropped (PRD-D-32). Check the mobile layout in desktop Chrome DevTools device emulation (390 px); verify install on desktop Chrome.

## D. Live VERIFY spikes

ROADMAP 4.2–4.5 run on a throwaway local branch `spike/hybrid` (never pushed, never merged) in a separate worktree `../ConformUI-spike`. A scratch page under `spike/` has its own Vite config that reads env from the main checkout (`envDir`) and records results to `spike/results.jsonl`. From that worktree:

- Dev: `npx vite --config spike/vite.config.ts`, then http://localhost:5173/.
- CSP preview: `npx vite build --config spike/vite.config.ts && npx vite preview --config spike/vite.config.ts` (same port; stop dev first).

The spike branch exists only on the machine that created it. On another machine, recreate it if you need to re-run a spike; only the recorded answers on `main` matter.

## E. Working in parallel

Each workstream uses its own git worktree (ROADMAP/00-HOW-TO-USE.md):

1. `git fetch && git worktree add ../ConformUI-<task> -b phase<N>/<task>-<slug> origin/main`, then `cd` there and run `npm ci`.
2. Work, run `npm run check:fast` (and `npm run check` when the app changes), rebase on `origin/main`, push, open a PR into protected `main`.
3. Merge only when `ci` is green. After pushing, remove the worktree: `git worktree remove ../ConformUI-<task>`.

## F. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Vitest: `Cannot read properties of undefined (reading 'config')` | Node 24 (or older) on `PATH`. Install Node 26, restart terminals (A2). |
| `npm ci` fails on leftover directories in `node_modules` | Delete `node_modules` and retry. Windows: `cmd /c rmdir /s /q node_modules`. |
| Cloud AI returns 401/403 | Debug token not registered in App Check (B4), or `VITE_APPCHECK_DEBUG` is not `1`. |
| Env validation error on start | A `VITE_*` value in `.env.local` is missing (A6). Restart `npm run dev` after editing. |
| Cloud AI blocked by referrer | App not on `http://localhost:5173` (B5). Free the port and rerun. |
| Model stays `'downloadable'` | The download needs a click on the page content, not the console (C3). |
| Model `'unavailable'` | Check the Broker State criteria (VRAM, disk) and the flags (C1, C2). |
| Hex-colour test fails | No hex literals in `src` outside token files (SPEC-UI-02). Use the design tokens. |
