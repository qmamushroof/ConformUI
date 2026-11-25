# 4.3 ai-engine

**[◀ 4.2 firebase](04-02-FIREBASE.md)** · [SPEC index](../SPEC.md) · **[4.4 imaging + measure ▶](04-04-MEASURE.md)**

`src/platform/ai-engine`. The only code importing `firebase/ai` (PRD-D-06, PRD-D-11, PRD-R-13). Task-agnostic: it builds a model for a mode, sends one single-turn structured request, validates nothing itself except the transport guards; callers validate with kernel zod schemas.

## 4.3.1 Public API

```ts
export function createAiEngine(d: { app: FirebaseApp; config: RuntimeConfig; clock: Clock }): AiEngine;  // kernel port §4.1.3
// inside: const ai = getAI(app, { backend: new GoogleAIBackend() });   // Gemini Developer API (PRD-D-26)
export function schemaFor(task: AiTask): { cloud: Schema; device: object /*JSON Schema*/ };            // from kernel zod, §4.3.4
```

## 4.3.2 Facts checked (docs 2026-11-25: hybrid on-device inference, hybrid web get-started, hybrid configuration options, hybrid structured output; `@firebase/ai` 3.1.0 `ai-public.d.ts`)

| Fact | Status |
|---|---|
| Web hybrid needs SDK >= 12.5.0 and Chrome desktop >= 139; flag `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` = Enabled for local testing | Docs |
| `InferenceMode` = `PREFER_ON_DEVICE` (`"prefer_on_device"`), `ONLY_ON_DEVICE`, `PREFER_IN_CLOUD`, `ONLY_IN_CLOUD`; `HybridParams = { mode, onDeviceParams?: { createOptions?, promptOptions? }, inCloudParams?: ModelParams }` | Typings 3.1.0 |
| During a model download: `ONLY_ON_DEVICE` **waits** for the download (minutes) — only if `initializeDeviceModel` ran on the same model instance; otherwise `create()` starts a download without a user gesture and fails. `PREFER_*` and `ONLY_IN_CLOUD` use the cloud | Docs |
| `result.response.inferenceSource?: InferenceSource`; constants `InferenceSource.ON_DEVICE = "on_device"`, `IN_CLOUD = "in_cloud"` (the config doc prints `ON_DEVICE`/`IN_CLOUD`: always compare with the imported constant, never a literal). The SDK sets it on every hybrid response | Typings 3.1.0 |
| `model.initializeDeviceModel(onDownloadProgress?: (progressValue: number) => void): Promise<void>`; call on/after a user gesture, before prompts; progress is a 0..1 fraction | Docs + typings |
| `createOptions: { expectedInputs?, expectedOutputs?, initialPrompts?, signal?, monitor? }` (defaults: image + English text input, English text output); `promptOptions: { responseConstraint?: object }` | Typings 3.1.0 |
| Structured output, hybrid: cloud `inCloudParams.generationConfig: { responseMimeType: 'application/json', responseSchema }`; device `onDeviceParams.promptOptions.responseConstraint` (Schema helper or plain JSON Schema) | Docs + typings |
| Parts: `TextPart { type: 'text'; text }`, `InlineDataPart { type: 'inlineData'; inlineData: { mimeType, data /*base64, no data: prefix*/ } }`; `generateContent(string \| Array<string \| Part> \| GenerateContentRequest)`. The on-device path converts image parts by fetching a `data:` URL, so CSP `connect-src` must allow `data:` (`SPEC-SEC-08`) | Typings 3.1.0 |
| `initialPrompts` entries are `LanguageModelMessage { role, content: [{ type: 'text', value }] }`; `inCloudParams.systemInstruction` is **not** forwarded on-device, so the system text is set in both places | Typings 3.1.0 |
| On-device: single-turn only, text and text+image (JPEG, PNG; inline data only), JSON/enum output, **9,216-token limit**, no tools/grounding/function calling, no PDF/audio/video; absent from AI monitoring | Docs |
| Default cloud model `gemini-3.5-flash-lite` (SDK >= 13.0.0), overridable via `inCloudParams.model` | Docs |
| `LanguageModel.availability()` → `available` / `downloadable` / `downloading` (and `unavailable`) | Docs (Chrome Prompt API) |
| Image token cost on-device, and whether one on-device prompt accepts more than one image | **VERIFY** spike A2 |
| Exact availability signal when the multimodal flag is off (image `availability` returns `unavailable` vs throws) and whether the flag is still required on current stable Chrome | **VERIFY** spike A1 |
| Chrome's model is "Gemini Nano 4" (PRD-§7). The Prompt API has no model/version parameter; record `chrome://on-device-internals` model info at demo time | **VERIFY** spike A3 |

## 4.3.3 Model construction (`SPEC-AI-01`, PRD-H-04, PRD-D-18)

| `AiMode` | `getGenerativeModel(ai, …)` | Used by |
|---|---|---|
| `ONLY_ON_DEVICE` | `{ mode: InferenceMode.ONLY_ON_DEVICE, onDeviceParams: { createOptions: { expectedInputs: [{type:'text',languages:['en']}, …(images? [{type:'image'}] : [])], expectedOutputs: [{type:'text',languages:['en']}], initialPrompts: [{ role:'system', content: [{ type:'text', value: system }] }] }, promptOptions: { responseConstraint } } }` | Auto first pass before consent |
| `PREFER_ON_DEVICE` | as above + `inCloudParams: { model: cloud_first_pass_model, systemInstruction: system, generationConfig: { responseMimeType:'application/json', responseSchema } }` | Auto first pass after Project consent |
| `ONLY_IN_CLOUD` | `{ mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams: { model, systemInstruction, generationConfig } }`; `model` = `deep_model` for `deep-analysis`, else `cloud_first_pass_model` | Cloud-only mode, Deep Analysis |

- `SPEC-AI-02` (guards): (a) a mode other than `ONLY_ON_DEVICE` requires `req.consent` (project or deep scope) else `CONSENT_REQUIRED`; `deep-analysis` requires scope `deep`. (b) An `ONLY_ON_DEVICE` result whose `inferenceSource !== InferenceSource.ON_DEVICE` is discarded → `AI_FAILED`. (c) An `ONLY_ON_DEVICE` call is never made unless `status().device === 'available'` (avoids the silent waiting download).
- `SPEC-AI-03`: model instances cached per `(mode, task, model, promptVersion, hasImages)`; rebuilt when Remote Config model names change. The `ONLY_ON_DEVICE` instance used by `downloadDeviceModel` is the one reused for prompts (same `createOptions`).
- `SPEC-AI-04`: `AiResponse.engine = response.inferenceSource === InferenceSource.ON_DEVICE ? 'on-device' : 'cloud'`; a missing `inferenceSource` (defensive branch only; the SDK always sets it) → `'cloud'` under `ONLY_IN_CLOUD`, `AI_FAILED` otherwise (never assumed). `bytesSent` = UTF-8 byte length of `JSON.stringify({system,user,images})` when engine is cloud, else 0 (labelled "request payload bytes" in the UI).

## 4.3.4 Request shape and structured output (`SPEC-AI-05`, PRD-H-01)

Content = `[ { type:'text', text: user }, ...images.map(i => ({ type:'inlineData', inlineData: { mimeType: i.mime, data: i.base64 } })) ]`. One request = one task = one JSON object. `schemaFor(task)` derives both the Firebase `Schema` (cloud) and JSON Schema (device) from the kernel zod schema via one mapper (unit-tested: enums, required, arrays, nullable); length/range limits are re-checked by zod after the call.

| Task | Output (zod, kernel) |
|---|---|
| `extract-contract` | `{ requirements: { category, statement, condition, checkKind, box: [x0,y0,x1,y1] /*0..1000 of the given image*/, matchHint: { tag?, role?, text? }, expectedText?, expectedCount?, primary? }[] /*≤8*/ }` |
| `infer-responsive` | `{ items: { fromRequirementId, checkKind: 'visible'\|'presence'\|'dominant-text', statement, condition }[] /*≤6*/ }` |
| `judge` | `{ verdict: 'pass'\|'fail'\|'uncertain', confidence: 'high'\|'medium'\|'low', explanation /*≤300*/, suggestedFix /*≤200*/ }` |
| `deep-analysis` | `{ items: { findingId, status: 'fail'\|'pass'\|'needs-review', confidence, explanation, suggestedFix, crossViewportCause? }[] }` |

`SPEC-AI-06`: on zod failure retry **once** with `user + "\nReturn only valid JSON matching the schema."`; second failure → `AI_BAD_OUTPUT` (callers mark the item Needs review, PRD-H-01, PRD-M-05). Raw model text is never returned to features.

## 4.3.5 Status and download (`SPEC-AI-07`, PRD-H-06, PRD-F-11.1, PRD-F-11.2)

- `status()`: not Chromium desktop (`navigator.userAgentData?.mobile` or no `Chrome` brand) → `unavailable/not-desktop-chrome`; Chrome major < 139 → `chrome-too-old`; `typeof LanguageModel === 'undefined'` → `no-prompt-api`. Else text `availability({ expectedInputs:[{type:'text',languages:['en']}], expectedOutputs:[{type:'text',languages:['en']}] })` maps to `device`; `deviceImage` = same call adding `{type:'image'}` → `available|downloadable|downloading` = true, `unavailable` = false + reason `image-flag-off`, throw = `'unknown'`. `online = navigator.onLine`; `cloud = cloud_enabled ? 'enabled' : 'disabled'`.
- `downloadDeviceModel(onProgress)`: only from a click handler; builds the `ONLY_ON_DEVICE` model (`expectedInputs` text-only when `deviceImage !== true`, else text + image) and calls `initializeDeviceModel(onProgress)`; resolves with fresh status. Re-read status on focus, `online`/`offline`, and every 2 s while `downloading`.

## 4.3.6 Other rules

| ID | Rule |
|---|---|
| `SPEC-AI-08` | Timeouts: on-device 45 s, cloud 60 s, via `AbortSignal` + `Promise.race`; timeout → `AI_FAILED` (retryable). |
| `SPEC-AI-09` | Before any cloud-capable call: `cloud_enabled` else `CLOUD_DISABLED`; offline and mode `ONLY_IN_CLOUD` → `OFFLINE`. |
| `SPEC-AI-10` | Error mapping (`AIError.code` values from typings: `error`, `request-error`, `response-error`, `fetch-error`, `invalid-content`, `api-not-enabled`, `invalid-schema`, `parse-failed`, `unsupported`, …): HTTP 429 (`customErrorData.status`) → `QUOTA_EXCEEDED`; 401/403 → `APPCHECK_FAILED`; blocked/empty candidates → `AI_BLOCKED`; `parse-failed` → retry path. By mode: `ONLY_ON_DEVICE` + (`api-not-enabled` \| `unsupported` \| device unavailable) → `DEVICE_UNAVAILABLE`; cloud-capable mode + `api-not-enabled` → `AI_NOT_ENABLED` (copy: "Enable Firebase AI Logic in the console"); else `AI_FAILED`. |
| `SPEC-AI-11` | Images: only `image/jpeg`/`image/png`, prepared by `ImageCodec.crop` (§4.4.2): on-device max side 1024 px (VERIFY A2), cloud max side 1536 px, JPEG q0.85. Judge requests send **one** side-by-side image (design left, implementation right, `ImageCodec.composePair`) so the on-device single-image path is always valid. |
| `SPEC-AI-12` | `FakeAiEngine` (`src/app/testing/`) implements the same port with scripted status and canned JSON per task, records every `AiRequest`, and applies `SPEC-AI-02` guards. CI never calls real AI (§7.2). |
| `SPEC-AI-13` | README table of `InferenceMode` per feature: first pass before consent `ONLY_ON_DEVICE`; after Project consent `PREFER_ON_DEVICE`; Cloud-only mode and Deep Analysis `ONLY_IN_CLOUD`. |

## 4.3.7 Acceptance tests

`SPEC-AI-02` guard table (fake SDK module via `vi.mock('firebase/ai')`); `SPEC-AI-04` mapping with both constants (plus the defensive missing-value branch); `SPEC-AI-06` malformed → retry → `AI_BAD_OUTPUT`; `SPEC-AI-07` status table with stubbed `LanguageModel`; `SPEC-AI-10` error map per mode; schema mapper round-trip for all four tasks; `initialPrompts` content shape.
