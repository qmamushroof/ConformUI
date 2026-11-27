# ConformUI

Design acceptance testing for AI-built websites. Turn a design into a checkable contract, verify the implementation against it with measured evidence, and hand the failures back to your coding agent.

Hosted demo: https://conformui.web.app
Repository: https://github.com/qmamushroof/ConformUI
Video: to be added

## What it does

ConformUI answers one question: "Does this implementation satisfy the design it was meant to implement?" It is an installable web app (PWA) with no backend and no account. It is not a chatbot and not a visual-regression tool.

1. You add a design reference (an image) and an implementation capture (a screenshot, plus an optional DOM snapshot) for each viewport, Desktop and Mobile.
2. The first pass extracts a Design Acceptance Contract (the Contract): a list of Requirements, each labelled Explicit or Inferred and each with a check type of Measured, Visual or Judged. You review, edit and lock it.
3. A Run checks the Contract against the captures. Each Requirement ends as Pass, Fail, Needs review or Not checked, and each failure becomes a Finding with Evidence (design and implementation crops, a diff overlay, measured deltas), a severity of Critical, Major or Minor, a confidence of High, Medium or Low, a suggested fix and a verification condition.
4. You copy a Fix prompt for your coding agent, fix the page, and Re-verify. Each Requirement then shows Resolved, Remaining, New, Regressed or Still passing.

Every number comes from a deterministic engine, never from a model. Models only extract, judge and, on request, deepen the analysis.

## How Firebase AI Logic is used

All model calls go through the Firebase AI Logic web SDK (`firebase/ai`) using hybrid inference with the Gemini Developer API. The code that calls AI Logic is in [`src/platform/ai-engine/`](src/platform/ai-engine/); nothing else in the app imports the AI SDK.

### InferenceMode per feature

| Feature | InferenceMode | When |
|---|---|---|
| First pass (Contract extraction, Judged checks, Inferred responsive expectations) before cloud consent | `ONLY_ON_DEVICE` | Auto mode, on-device model already available |
| First pass after the Project has cloud consent | `PREFER_ON_DEVICE` | Auto mode, after "Use cloud for this project" |
| First pass in Cloud only mode | `ONLY_IN_CLOUD` | Setting chosen by the user, after Project consent |
| Deep Analysis | `ONLY_IN_CLOUD` | Explicit button, after the confirm sheet |

### Details

- **`inferenceSource` badge.** Every AI output stores and shows the Engine that produced it, read from the SDK's reported `inferenceSource` (`InferenceSource.ON_DEVICE` or `InferenceSource.IN_CLOUD`). Measured outputs are labelled Measured. The Engine trace shows the bytes sent to the cloud, which is 0 for on-device calls.
- **Structured output validated by zod.** Each call is one task with one schema. The schema is passed to the SDK (`responseConstraint` on device, `responseSchema` in the cloud) and the result is validated again with zod. Invalid output is retried once, then the item is marked Needs review. Raw model text is never shown as a result. Numbers in model text are checked against engine measurements and replaced by a deterministic template if they do not match.
- **Consent-safe mode mapping.** One pure function, `resolveMode`, picks the mode, and the adapter guards it again. Before consent only `ONLY_ON_DEVICE` can be used; the `PREFER_*` modes are never used before consent because they fall back to the cloud silently. A cloud-capable call needs a consent token that can only be minted from a user click. When the device cannot answer, the app asks once per Project instead of calling.
- **App Check.** Cloud calls are protected with App Check: reCAPTCHA Enterprise on the hosted domain, the debug provider on localhost only. App Check is enforced for AI Logic.
- **Remote Config keys.** Model names, thresholds and flags come from Remote Config with bundled defaults, so the app works offline. The keys, with defaults, live in [`remoteconfig.template.json`](remoteconfig.template.json): `cloud_first_pass_model`, `deep_model`, `prompt_version`, `cloud_enabled`, `deep_daily_cap`, `feature_ai_infer_responsive`, `size_tolerance_pct`, `major_deviation_pct`, `spacing_tolerance_pct`, `pixel_threshold`, `visual_diff_ratio`, `presence_ink_ratio`, `colour_delta_e`, `snap_min_iou`, `search_window_px`, `width_mismatch_pct`.

## The three engines

| Engine | What it is | Strength |
|---|---|---|
| On-device | Gemma 4 (Chrome built-in AI, enabled by `#gemma4-for-built-in-ai`) in desktop Chrome, through AI Logic hybrid inference | Private, free, works offline |
| Cloud | Gemini through Firebase AI Logic | More capable reasoning, works in any browser |
| Measured | Deterministic TypeScript engine: region snapping, image and region diff, geometry, DOM snapshot measurements | Exact and reproducible |

## Features and value

- **Projects** stored locally in IndexedDB. Your designs stay on your machine unless you choose the cloud.
- **Inputs** per viewport: design references and implementation captures (PNG, JPEG or WebP), plus an optional DOM snapshot.
- **DOM snippet**: a script you copy from the app and run on your own page. It reads element boxes, text and key computed styles, and sends nothing over the network.
- **Design Acceptance Contract** with Explicit and Inferred Requirements across the categories Presence, Content, Position/alignment, Size, Spacing, Typography hierarchy, Colour and Responsive.
- **Verification Run** with per-Requirement status and an Engine trace.
- **Findings and Evidence** with severity, confidence, a suggested fix and a verification condition.
- **Deep Analysis**: an explicit, cloud-only pass that resolves Needs review items and explains causes across viewports.
- **Re-verify** against the same Contract.
- **Exports**: a Fix prompt for a coding agent, and the Contract and report as Markdown and JSON.
- **Demo sample**: one click opens a sample Project with planted defects.
- **Engine status and settings**: model readiness, enable steps, mode, cloud consent, a privacy counter and data deletion.
- **Installable and offline**: the app shell and the sample open offline.

## Screenshots

Screenshots are added at release under `docs/screenshots/` (for example `docs/screenshots/projects.png`, `docs/screenshots/contract.png`, `docs/screenshots/finding.png`).

## Quick start

Requires Node 26 or newer.

```
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with your Firebase web config and App Check values; the variables are listed in `.env.example`. The dev server runs at http://localhost:5173 (the port matters: the API key referrer list contains it). Other scripts: `npm run build`, `npm run preview`, `npm run check:fast` (lint, types, dependency rules, unit and component tests) and `npm run check` (adds the build, size checks and end-to-end tests with a fake AI engine).

## Setup

One-time steps for your own Firebase project (details in [docs/SETUP.md](docs/SETUP.md)):

1. Create the Firebase project, enable **AI Logic** with the Gemini Developer API, and keep AI monitoring off.
2. Register the Web app, create a score-based reCAPTCHA Enterprise Web key for the Hosting domains, register it in App Check, enforce App Check for AI Logic, and register dev debug tokens before first run. Add each Hosting preview channel host to the key domains and the API key referrers before testing on it.
3. Publish Remote Config from `remoteconfig.template.json`, either by console import or `npx firebase deploy --only remoteconfig`.
4. Restrict the API key by referrer. On the Spark plan the default AI Logic per-user quota is kept; if you upgrade to Blaze, set a budget alert and quotas.
5. Record the hosted URL (the Hosting default domain, https://conformui.web.app for this project) after the first deploy.

## Enabling on-device AI in Chrome

On-device inference needs desktop Chrome 139 or newer. The on-device model is Gemma 4; Chrome's default Gemini Nano does not satisfy the requirement.

1. Open `chrome://flags`, enable `#gemma4-for-built-in-ai` and `#prompt-api-multimodal-input`, and relaunch.
2. In the app, open Settings and use **Download model**. The download needs a click and can take several minutes.
3. To confirm Gemma 4 answers, open `chrome://on-device-internals`, go to Event Logs before prompting, then run a prompt. You should see "Loading model [gemma4_gpu_high_tier_model] on backend [GPU]".

The app detects a missing flag or API and shows these steps. Chrome decides which model variant runs; a page cannot choose.

## Tested browsers

- Desktop Chrome 158 on Windows: on-device and cloud paths.
- Mobile layout: checked in desktop Chrome device emulation. Android hardware is not verified.
- Other browsers and Android use the cloud path after consent.

## Deploy

Deploys are manual from a developer machine; there is no deploy workflow.

```
npm ci && npm run build && npx firebase deploy --only hosting
```

A preview channel is available with `npx firebase hosting:channel:deploy preview --expires 7d`. Hosting serves an enforced Content Security Policy (proven with zero violations on the production host).

## Verify checklist

Results were recorded on the hosted app at https://conformui.web.app. Rows marked pending need a desktop Chrome with on-device Gemma and are recorded by the owner.

| Check | Result |
|---|---|
| Hosted URL loads over HTTPS and installs on desktop Chrome | Loads over HTTPS (HTTP 200, HSTS, nosniff, no-referrer); offline second visit opens the shell and the sample; install on desktop Chrome pending |
| Sample Extract (On-device), Run, Deep Analysis (Cloud), Copy fix prompt, Re-verify, export | pending |
| Both `inferenceSource` values seen; App Check accepted (no 401 or 403) | App Check accepted, no 401 or 403, cloud inferenceSource seen (Gemini through AI Logic); on-device value pending |
| Offline first pass with the network off (on-device) | pending |
| Deterministic Run stages for the sample, 2 viewports, within 3 s | pending |
| On-device Contract extraction under 60 s | pending |
| AI extraction covers at least 4 of the 6 measurable planted defects (Engine reported) | pending |
| Zero CSP violations on Hosting for one Deep Analysis and one on-device image prompt | Enforced CSP: zero violations for the sample flow, cloud Extract and Deep Analysis send; on-device image prompt pending |
| Lighthouse scores on the preview (advisory) | Production host: performance 88, accessibility 95, best practices 77, SEO 91; bundle size check passes |

## Demo video

Video: to be added

## Honest limits

- On-device inference is desktop Chrome only. Android and other browsers use the cloud after consent.
- On-device calls are single-turn with a small token limit, and images are downscaled before sending.
- The model version on device is chosen by Chrome, not by the app.
- The sample's pre-computed results are hand-authored.
- Judged checks are model opinions labelled with Engine and confidence; only Measured and Visual checks are exact.
- Android is not verified on hardware.

## Privacy

Projects, images, DOM snapshots, Contracts, Runs and settings stay on your device in IndexedDB. Nothing is sent to Google until you grant cloud consent for a Project or press Send in Deep Analysis. Then the listed images, prompt text, Contract and measurements are sent through Firebase AI Logic (Gemini Developer API), together with an App Check token and a Firebase installation id. The DOM snippet never reads form values, cookies or storage, and the app has no account, analytics or backend of its own. Settings shows a counter of what has been sent, and you can delete one Project or everything.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
