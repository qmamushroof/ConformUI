# 5. Firebase and AI Engine

**[◀ 4. VERIFY Spikes](04-SPIKES.md)** · [Roadmap index](../ROADMAP.md) · **[6. Storage and Imaging ▶](06-A-STORAGE-IMAGING.md)**

| | |
|---|---|
| **Depends on** | G0. Budget 1.75 h, lane A, Day 1 |
| **Delivers** | `platform/firebase` (`initFirebase`, `RuntimeConfig`), `remoteconfig.template.json`, `platform/ai-engine` (`createAiEngine`, `schemaFor`) |
| **Read** | SPEC §4.2, §4.3, §4.1.3–4.1.6, §9 (S1, S4, S5, S11, S17) |
| **Covers** | SPEC-FB-01..08, SPEC-AI-01..11, PRD-H-01, PRD-H-03, PRD-H-04, PRD-H-07, PRD-H-08, PRD §11 item 1 |

Touches only `src/platform/firebase`, `src/platform/ai-engine`, `remoteconfig.template.json` and their tests. All SDK calls are mocked in unit tests (`vi.mock('firebase/ai')`); real calls happen only in 4.x and 14.4.

### 5.1 initFirebase and Remote Config · A · 0.5 h · needs G0
- [x] `initFirebase(env)`: init order, reCAPTCHA Enterprise provider, dev-only debug branch (SPEC-FB-01, SPEC-FB-03, SPEC-FB-04).
- [x] Remote Config defaults from kernel `DEFAULT_RUNTIME_VALUES`, background `fetchAndActivate` that never blocks (SPEC-FB-02), `RuntimeConfig.get()` parsed key by key (SPEC-FB-06, SPEC-FB-07).
- [x] `remoteconfig.template.json` (SPEC-FB-08).

**Accept:** SPEC §4.2.4 tests (FB-04 dist grep, FB-07 invalid values → defaults, FB-08 template parity); init-order test with mocked SDK.

### 5.2 schemaFor mapper · A · 0.25 h · needs G0
- [x] One mapper from kernel zod to Firebase `Schema` (cloud) and JSON Schema (device) for the four tasks (SPEC-AI-05).

**Accept:** round-trip test for all four tasks: enums, required, arrays, nullable.

### 5.3 Model construction and engine label · A · 0.4 h · needs 5.1, 5.2
- [x] `getAI(app, { backend: new GoogleAIBackend() })` after App Check; `getGenerativeModel` per `AiMode` exactly as the SPEC §4.3.3 table (SPEC-AI-01); system text in both `initialPrompts` and `systemInstruction`.
- [x] Instance cache key and rebuild on model-name change (SPEC-AI-03).
- [x] `engine` from `inferenceSource` compared with the imported constant; `bytesSent` (SPEC-AI-04).

**Accept:** mocked SDK asserts mode and params per `AiMode`; `ONLY_ON_DEVICE` never gets `inCloudParams`; mapping test with both constants and the missing-value branch.

### 5.4 Guards, retry, timeouts, errors · A · 0.4 h · needs 5.3
- [x] Consent and device guards (SPEC-AI-02, S1); pre-call checks (SPEC-AI-09); image MIME and max side (SPEC-AI-11).
- [x] zod validation by caller schema with one retry (SPEC-AI-06); timeouts (SPEC-AI-08); error map per mode (SPEC-AI-10).

**Accept:** SPEC §4.3.7 guard table; malformed fixture → retry → `AI_BAD_OUTPUT`; timeout via fake timers → `AI_FAILED`; error map per mode incl. `AI_NOT_ENABLED` vs `DEVICE_UNAVAILABLE`.

### 5.5 status() and downloadDeviceModel() · A · 0.2 h · needs 5.3, 4.2 answer if available
- [ ] Status detection and mapping (SPEC-AI-07) with the A1 answer from 4.2.
- [ ] `downloadDeviceModel(onProgress)` builds the `ONLY_ON_DEVICE` instance reused for prompts (SPEC-AI-03).

**Accept:** status table test with stubbed `LanguageModel` (every `device` value and `reason`); download reuses the cached instance.

## Exit gate

- `npm run check:fast` green; `index.ts` exports only `initFirebase`, `createAiEngine`, `schemaFor` and types; depcruise `firebase-confined` passes.
- Merged at M1 ([14](14-INTEGRATION.md)).
