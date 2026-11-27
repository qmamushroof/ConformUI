# Devpost submission text: ConformUI

Copy each section into the Devpost form. The demo video link is added by the owner.

## Project name

ConformUI

## Tagline

Check AI-built pages against the design with Gemini Nano 4 (Gemma 4) on-device and Gemini in the cloud, then hand the failures back to your coding agent.

## Selected platform category

Web/Chrome: an installable PWA (Web, desktop and mobile), with on-device Gemini Nano 4 (Gemma 4) in desktop Chrome and cloud Gemini everywhere else.

## Links

- Working app: https://conformui.web.app
- Repository (public, Apache-2.0): https://github.com/qmamushroof/ConformUI
- Demo video: (YouTube link)

## Description

Gemini Nano 4 (Gemma 4) on-device via Firebase AI Logic hybrid inference, with Gemini cloud fallback, in one installable cross-platform PWA that works offline: the same codebase runs in desktop and mobile browsers, on-device in desktop Chrome and on cloud Gemini automatically everywhere else. AI coding agents build pages fast, and the pages drift from the design. Spacing is off, a heading is the wrong size, a section is missing on mobile. Checking by eye is slow, and asking a model "does this match?" gives an opinion, not evidence.

ConformUI is an installable web app (PWA) that answers one question: does this implementation satisfy the design it was meant to implement?

1. You add a design image and an implementation capture for Desktop and Mobile.
2. A first pass extracts a Design Acceptance Contract: a list of Requirements, each labelled Explicit or Inferred, each with a check type of Measured, Visual or Judged. You review, edit and lock it.
3. A Run checks the Contract against the captures. Each failure becomes a Finding with Evidence (crops, a diff overlay and measured deltas), a severity, a confidence, a suggested fix and a verification condition.
4. You copy a Fix prompt into your coding agent, fix the page, and Re-verify. Each Requirement then shows Resolved, Remaining, New, Regressed or Still passing.

Every number comes from a deterministic engine, never from a model. Models only extract, judge and, on request, deepen the analysis. It is not a chatbot.

## How Firebase AI Logic is used

Gemini Nano 4 (Gemma 4) runs on-device through Firebase AI Logic hybrid inference, with Gemini in the cloud as a labelled fallback. On-device inference runs Gemma 4 through Chrome's built-in AI (Prompt API, enabled with `#gemma4-for-built-in-ai`). Google describes Gemma 4 as the foundation for Gemini Nano 4, so the app targets the Gemini Nano 4 generation on-device. Source: [Announcing Gemma 4 in the AICore Developer Preview](https://developer.android.com/blog/posts/announcing-gemma-4-in-the-ai-core-developer-preview) (Android Developers blog, 2 April 2026): "These models are the foundation for the next generation of Gemini Nano, so code you write today for Gemma 4 will automatically work on Gemini Nano 4-enabled devices". That post is about Android AICore and does not mention Chrome.

All model calls go through the Firebase AI Logic web SDK (`firebase/ai`) with hybrid inference and the Gemini Developer API. The code is in `src/platform/ai-engine/` (`model-factory.ts` calls `getAI`, `getGenerativeModel` and sets the `InferenceMode`; `run.ts` runs the request and reads `inferenceSource`).

| Feature | InferenceMode |
|---|---|
| First pass before cloud consent | `ONLY_ON_DEVICE` (Gemini Nano 4 (Gemma 4) through the Chrome Prompt API) |
| First pass after the Project has cloud consent (Auto mode) | `PREFER_ON_DEVICE` |
| First pass in Cloud only mode | `ONLY_IN_CLOUD` |
| Deep Analysis (explicit button, after a confirm sheet) | `ONLY_IN_CLOUD` |

- Every AI output shows the Engine that made it (On-device, Cloud or Measured), read from the SDK's `inferenceSource`.
- Output is structured. One schema per task goes to the SDK and the result is validated again with zod. Invalid output is retried once, then marked Needs review.
- Mode mapping is consent-safe. A pure function picks the mode and the adapter guards it again. `PREFER_*` modes are never used before the user consents, because they can fall back to the cloud silently.
- App Check (reCAPTCHA Enterprise) protects the cloud calls and is enforced for AI Logic.
- Remote Config supplies model names, thresholds and flags with bundled defaults, so the app works offline.

## Features

- Local Projects in IndexedDB. Designs stay on your machine unless you choose the cloud.
- Design Acceptance Contract with Explicit and Inferred Requirements across eight categories.
- Deterministic Run with per-Requirement status and an Engine trace.
- Findings with Evidence, severity, confidence, suggested fix and verification condition.
- Deep Analysis: an explicit cloud pass for items that need review.
- Re-verify against the same Contract.
- Exports: a Fix prompt for a coding agent, and the Contract and report as Markdown and JSON.
- A DOM snippet that reads element boxes, text and key styles from your page and sends nothing over the network.
- One-click sample Project with planted defects.
- Engine status and settings: model readiness, mode, cloud consent, privacy counter and data deletion.
- Installable, with the app shell and sample available offline. One codebase, responsive from phone to desktop, tested with Playwright on Chromium, WebKit / Safari and Firefox at desktop size, plus Pixel 7 and iPhone 14 (iOS-emulated) viewports.

## Value proposition

You get trustworthy numbers instead of a model's opinion, a short list of what to fix, a prompt your coding agent can act on, and proof that the fix worked. On-device inference keeps your designs private and the first pass free. The cloud adds depth only when you ask for it.

## Testing instructions

No login, payment or install is needed.

1. Open https://conformui.web.app in desktop Chrome.
2. Click **Try the sample**, then **Run**. Open a Finding to see the Evidence.
3. Check the Engine pill in the header, or Settings, for the active engine.
4. Click **Copy fix prompt**, then **Re-verify**.
5. Open **Deep Analysis** and confirm the sheet to run the cloud pass.
6. To try your own design, click **Start a project**, add a design image and a screenshot, click **Extract contract**, review and lock the Contract, then **Run**.

For the on-device path, enable `chrome://flags/#gemma4-for-built-in-ai` and `chrome://flags/#prompt-api-multimodal-input`, relaunch, then use **Download model** in Settings. The full steps are in the README. Without on-device support, the app asks for cloud consent per Project and uses the cloud.

## What was built during the hackathon

All of it. The first commit is dated 25 November 2026, and work continued to 27 November 2026. The submission period began on 11 November 2026. The app, the sample site, the tests and the docs were written in that period (see `git log`).

## Requirements checklist

| Requirement | Evidence |
|---|---|
| GenAI app | Contract extraction, Judged checks and Deep Analysis use Gemini models. See [README](../README.md) and `src/features/contract/extract.ts`, `src/features/deep-analysis/service.ts`. |
| Firebase AI Logic imported and called at runtime | `firebase/ai` is imported in `src/platform/ai-engine/model-factory.ts` (`getAI`, `getGenerativeModel`, `InferenceMode`) and `src/platform/ai-engine/run.ts`. Tests: `tests/unit/ai-engine/model-factory.test.ts`, `tests/unit/ai-engine/run.test.ts`. |
| App Check | `src/platform/firebase/index.ts` (`initializeAppCheck`, reCAPTCHA Enterprise; debug provider on localhost only). Test: `tests/unit/firebase/init-firebase.test.ts`. Enforced for AI Logic in the Firebase console. |
| Remote Config | `src/platform/firebase/runtime-config.ts` and `remoteconfig.template.json` (keys and defaults). |
| Gemini Nano 4 / Gemma 4 on-device via Firebase AI Logic hybrid | `InferenceMode.ONLY_ON_DEVICE` and `PREFER_ON_DEVICE` in `src/platform/ai-engine/model-factory.ts`. Chrome Event Logs show "Loading model [gemma4_gpu_high_tier_model]"; see `docs/SETUP.md` section C. |
| Cloud fallback | `PREFER_ON_DEVICE` and `ONLY_IN_CLOUD` after consent. Mode rules in `src/shared/kernel/consent.ts`. Tests: `tests/e2e/e3-consent.spec.ts`, `tests/unit/kernel`. |
| Offline handling | Service worker `src/app/sw.ts`; `OFFLINE` error code in `src/shared/kernel/errors.ts`. Tests: `tests/e2e/e2-offline.spec.ts`, `tests/e2e/e11-pwa.spec.ts`. |
| Model availability and error handling | `src/platform/ai-engine/status.ts` and the Engine panel in Settings (download, unavailable reasons, enable steps). Tests: `tests/unit/ai-engine/status.test.ts`, `tests/e2e/error-states.spec.ts`. |
| Inference mode shown to the user | Engine badge and Engine trace read from `inferenceSource` in `src/platform/ai-engine/run.ts`; Engine pill in the header; Settings > Engine. |
| Public repo | https://github.com/qmamushroof/ConformUI |
| Apache-2.0 licence detectable | `LICENSE` is the unmodified Apache-2.0 text, and GitHub detects it as Apache-2.0. `NOTICE` and `package.json` agree. Test: `tests/unit/license.test.ts`. |
| Setup instructions | [README](../README.md) (Quick start, Setup, Enabling on-device AI) and [docs/SETUP.md](SETUP.md). |
| No secrets or PII committed | `.env*` is git-ignored except `.env.example` (variable names only). The scan `git ls-files \| xargs grep -nE "AIza\|private_key\|BEGIN (RSA\|PRIVATE)"` finds nothing. The Firebase web config is read from `VITE_*` variables. The web API key is public by design, appears in built output only, and is restricted by referrer. |
