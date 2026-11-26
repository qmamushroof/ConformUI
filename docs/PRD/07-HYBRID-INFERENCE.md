# 7. Hybrid Inference

**[◀ 6. Product Principles](06-PRODUCT-PRINCIPLES.md)** · [PRD index](../PRD.md) · **[8. Feature Areas ▶](08-FEATURE-AREAS.md)**

Three engines, each doing what it is best at. Hybrid is a visible feature, not a hidden fallback.

| Engine | What it is | Strength |
|---|---|---|
| **On-device** | Gemma 4 (Chrome built-in AI, enabled by `#gemma4-for-built-in-ai`) in desktop Chrome via Firebase AI Logic hybrid inference | Private, free, offline, no network latency |
| **Cloud** | Gemini via Firebase AI Logic | More capable reasoning, multi-image context, works on any browser |
| **Measured** | Deterministic TypeScript engine (image/region diff, geometry, DOM snapshot measurements) | Exact, reproducible, trustworthy numbers |

## Who does what

| Task | Engine | Fallback | Why the user benefits |
|---|---|---|---|
| Extract the Contract from a design reference (Requirements, categories, region suggestions) | On-device | Cloud (after consent, H-05) | Unreleased client designs stay on the machine; instant; works offline. |
| First-pass discrepancy candidates: Judged checks per Requirement (status + confidence only; Finding text stays a deterministic template); (P1) Suggested requirements | On-device | Cloud (after consent) | Private triage in seconds, before anything is shared. |
| Propose Inferred responsive expectations from a desktop-only design | On-device | Cloud (after consent) | Mobile gets checked even without a mobile mock, clearly labelled advisory. |
| Alignment, region snapping, region diff, positions, sizes, deltas, overflow, text and style comparison from DOM snapshot, Pass/Fail of Measured and Visual checks | Measured | — | Numbers are exact and repeatable; models cannot hallucinate them. |
| Finding statements, suggested fixes and verification conditions (deterministic templates; no first-pass AI "explain" task), Re-verify comparison, severity floor rules, engine trace, report and Fix prompt assembly | Measured | — | Same input, same report; works offline. |
| **Deep Analysis**: resolve Needs-review and low-confidence Findings, explain causes across viewports, structured fix recommendations | Cloud | None (disabled offline, with explanation) | Deeper reasoning over several images and the full Contract when the user wants certainty. |

**Text-only on-device:** if on-device image input is unavailable but text input is, Judged first-pass checks still run on-device from the DOM snapshot and engine measurements (text-only). Contract extraction from an image needs on-device image input or cloud.

## Rules

| ID | Rule |
|---|---|
| H-01 | **Discrete structured requests.** On-device inference is single-turn, not chat. Every AI call is one task with one structured output validated against a schema; invalid output is retried once, then the item is marked Needs review. Raw model text is never shown as a result. |
| H-02 | **AI never owns numbers or Finding text.** Engine measurements are passed to the model as data; the model refers to them, never produces them (P-02). The first pass has no AI "explain" task: Finding statements, fixes and conditions are deterministic templates; only Cloud Deep Analysis adds AI-written refinements, labelled Cloud. |
| H-03 | **Inference source is surfaced.** Each AI output stores and displays whether it ran On-device or Cloud, from the SDK-reported inference source. |
| H-04 | **Modes (P0: Auto, Cloud only; P1: On-device only).** Auto (default): before Project cloud consent, `ONLY_ON_DEVICE` is used only when the on-device model is already available; otherwise the app asks for cloud consent (H-05) instead of calling. After consent, `PREFER_ON_DEVICE`. Cloud only = `ONLY_IN_CLOUD`. Deep Analysis = `ONLY_IN_CLOUD`. `PREFER_*` modes are never used before consent, because they fall back to cloud silently. (P1) On-device only = `ONLY_ON_DEVICE` always. |
| H-05 | **Cloud consent.** Deep Analysis is an explicit button and its confirm sheet lists what is sent. When on-device is unavailable in Auto mode, the first pass asks once per Project to "Use cloud for this project" and lists what is sent; declining leaves Measured/Visual checks and manual Requirements available. Exception: on the demo sample, a Judged item no live engine can judge uses its labelled pre-computed result with no consent modal (§10). |
| H-06 | **Model readiness.** Engine status shows Available / Downloading (with progress) / Unavailable (with reason, including missing Chrome flag or API). The model download starts from a user action. While downloading, Auto offers the cloud path under H-05. |
| H-07 | **Remotely tunable.** Model names, thresholds, prompt versions and feature flags come from Remote Config with bundled defaults, so the app works offline and can be tuned without redeploy. |
| H-08 | **Protected.** Cloud calls go through App Check: reCAPTCHA provider (v3 or Enterprise — SPEC decides) for the hosted domain; debug provider for localhost/dev only. |

## Platform matrix

| Platform | First pass | Deep Analysis | Measured | Offline |
|---|---|---|---|---|
| Desktop Chrome 139+, multimodal flag on, model ready | On-device | Cloud | Yes | First pass + Measured |
| Desktop Chrome without flag / model not ready / other desktop browsers | Cloud (after consent); text-only on-device Judged checks where available | Cloud | Yes | Measured only |
| Android (installed PWA) | Cloud (after consent), labelled honestly | Cloud | Yes | Measured only |

Offline without on-device: existing Contracts can be re-verified with Measured/Visual checks; Judged checks show Not checked.

## Platform facts

Sources: [hybrid on-device inference](https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference), [hybrid web get-started](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started).

| Fact | Status |
|---|---|
| Hybrid on-device inference on web needs Chrome desktop 139+ and Firebase AI Logic JS SDK 12.5.0+. | Docs |
| On-device supports text and text+image (JPEG, PNG) prompts and structured output (JSON, enums); single-turn only, no chat; no function calling or Google Search grounding; files as inline data. | Docs |
| On-device token limit 9,216 tokens. | Docs |
| On-device image input requires enabling `chrome://flags/#prompt-api-multimodal-input`; the app detects this and shows copy-paste enable steps (F-11.1). | Docs — VERIFY at build |
| Modes `PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `PREFER_IN_CLOUD`, `ONLY_IN_CLOUD`; Prefer modes fall back to cloud while the model is downloading or unavailable (hence H-04). | Docs |
| Responses report `inferenceSource`, compared with the SDK constants `InferenceSource.ON_DEVICE` / `InferenceSource.IN_CLOUD` (values `"on_device"` / `"in_cloud"`; SDK 12.5.0+). | Docs |
| Model download is triggered on user activation via `initializeDeviceModel()`; it can take several minutes. | Docs |
| The cloud model is set explicitly (SPEC §4.1.6) and overridable via Remote Config (H-07). | Docs |
| On-device is Chrome desktop only; Android PWA uses cloud. | Docs |
| The on-device model is Gemma 4, not Chrome's default Gemini Nano v3. Chrome's default is Nano v3; enabling `chrome://flags/#gemma4-for-built-in-ai` makes a page-initiated `LanguageModel.create()` download `gemma4_component`. Verified 2026-11-26 on Chrome 158 via `chrome://on-device-internals` Event Logs (PRD-D-33). | Verified |
