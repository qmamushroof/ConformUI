# 10. Traceability and VERIFY

**[◀ 9. Decisions](09-DECISIONS.md)** · [SPEC index](../SPEC.md) · **(last)**

## 10.1 PRD → SPEC (every P0 requirement; [P1] marked)

PRD column uses short form; read as `PRD-<id>`.

| PRD | SPEC |
|---|---|
| P-01 Contract first | RUN-07, CON-05 |
| P-02 Measured, not guessed | MEAS-12, KERNEL-08, CON-02, S7 |
| P-03 Severity by impact | MEAS-09, RUN-05 |
| P-04 Explicit vs Inferred | CON-04, RUN-06, UI-04 |
| P-05 On-device first, consent | KERNEL-04..06, AI-02, DEEP-01, SEC-02 |
| P-06 Show the engine | AI-04, SET-09, RUN-12 |
| P-07 Evidence or silence | RUN-07 |
| P-08 Not a chatbot | §5 intro, AI-05 |
| P-09 Graceful degradation | RUN-01/02, RUN-13, CON-01 step 7, CON-03, UI-05 |
| P-10 Reproducible | MEAS-16, §4.1.6 runtime values, S14, TEST-03 |
| P-11 Local by default | STORE-05, SEC-01, APP-05 |
| P-12 Accessible | UI-03, UI-04, UI-06 |
| H-01 Discrete structured requests | AI-05, AI-06, S23 |
| H-02 AI never owns numbers | KERNEL-08, DEEP-06 |
| H-03 Inference source surfaced | AI-04, SET-09 |
| H-04 Modes ([P1] On-device only) | KERNEL-04..06, AI-01, SET-04 |
| H-05 Cloud consent | KERNEL-05, CON-01 step 1, RUN-01 step 3, DEEP-01/02, SET-05 |
| H-06 Model readiness | AI-07, SET-01, SET-03 |
| H-07 Remotely tunable | §4.1.6, FB-02, FB-06..08, S26 |
| H-08 App Check | FB-03..05, S5 |
| F-01.1, F-01.2 ([P1] F-01.3) | STORE-02, PROJ-06, §4.6.1 |
| F-02.1–02.4, F-02.6 ([P1] F-02.5) | PROJ-01..05, MEAS-01..04, KERNEL-12, PWA-06 |
| F-03.1–03.6 ([P1] region drawing, versioning) | CON-01, CON-02, CON-05..09, KERNEL-10/11, MEAS-07 |
| F-04.1–04.5 | MEAS-05, RUN-01..04, RUN-12, RUN-13, PERF-01 |
| F-05.1–05.4 ([P1] filters, F-05.5) | RUN-07, RUN-08, UI-01 |
| F-06.1–06.3 | DEEP-01..08 |
| F-07.1–07.3 ([P1] F-07.4) | RUN-09..11 |
| F-08.1–08.3 ([P1] Tablet, custom) | KERNEL-02 presets, RUN-01, CON-04, S24 |
| F-09.1, F-09.3, F-09.4 ([P1] F-09.2, F-09.5) | EXP-01..05 |
| F-10.1–10.5 ([P1] F-10.6) | DEMO-01..07, RUN-13, S28, S29 ([P1] DEMO-08) |
| F-11.1–11.5 | SET-01..07, AI-07 |
| F-11 screen layout, theme | SET-11 (`src/features/settings/ui`, `tests/component/settings`) |
| F-12.1, F-12.2 ([P1] F-12.3) | PWA-01..05, SET-08 |
| F-13.1–13.7 ([P1] F-13.8) | SNIP-01..08 |
| §8 empty/error states | UI-05 |
| M-01, M-02, M-09, M-10 | TEST-03, DEMO tests |
| M-03, M-05 | KERNEL-08, EXP-05, AI-06 |
| M-04, M-06 | SET-09, SEC-02, E1/E3/E4 |
| M-07, M-08, M-14 | manual smoke (§7.1), PERF-01/02, DEMO-03, §10.2 O1 |
| M-11, M-12, M-13 | UI-06/E12, PWA-02/E11, DEMO-02/RUN-13/E1 |
| R-01…R-14 | R-01 DEMO-05, RUN-13; R-02 RUN-05/06; R-03 CON-01; R-04 MEAS-05; R-05 MEAS-07/08; R-06 AI-11; R-07 SEC-09; R-10 SEC-07; R-11 SNIP-07; R-12 ARCH-*, ARCH-11 (build order); R-13 §4.3.2, §10.2; R-14 SET-02; R-08/R-09 product-only |
| D-02, D-03, D-14 | §2, §3, ARCH-10/11 |
| D-13, D-30 | DEPLOY-04 |
| D-28 | DEMO §4.11.2, S28 |
| D-31 | UI-02, PWA-01, S19, S30 |

## 10.2 Open VERIFY items (each = a spike in the first build step; record results per §1.2). Closed: A5 (the SDK always sets `inferenceSource`; the missing-value branch is defensive only), `initialPrompts` content form (typings), D2 (no deploy workflow).

| # | Item | Spike step |
|---|---|---|
| A1 | Multimodal flag detection and current flag requirements | In Chrome stable and Chrome ≥ 139 with/without `#prompt-api-multimodal-input`: log `LanguageModel.availability({expectedInputs:[{type:'image'}]})` (value or throw); run one `ONLY_ON_DEVICE` image prompt; adjust `SPEC-AI-07`/`SPEC-SET-02`. |
| A2 | On-device image token cost; multiple images per prompt | **Resolved 2026-11-26** (Chrome 158.0.8127.89, Gemma 4): one 1024x512 JPEG q0.85 band passes (~6.6 s); 1024x384 ~5-16 s; two 1024x512 images in one prompt pass (~13.8 s); no token-limit error. `SPEC-AI-11` max side stays 1024 (no 768 fallback). Explanations can be cut at schema `maxLength`. |
| A3 | Model identity (Gemma 4) | **Resolved 2026-11-26** (PRD-D-33): with `#gemma4-for-built-in-ai` enabled, Chrome 158.0.8127.89 downloads `gemma4_component` 2026.11.3.1140; Event Logs show "Loading model [gemma4_gpu_high_tier_model] on backend [GPU]". Default Nano v3 does not satisfy the requirement. README states this. |
| A4 | Cloud model ids `gemini-3.5-flash-lite`, `gemini-3.8-flash` available for the Gemini Developer API in AI Logic | **Resolved 2026-11-26**: one `ONLY_IN_CLOUD` call each succeeded (`gemini-3.5-flash-lite` 2.3-7 s, `gemini-3.8-flash` 21 s); defaults unchanged. One transient HTTP 500 "high demand" was seen and maps to retryable `AI_FAILED` (`SPEC-AI-10`, `SPEC-AI-08`). App Check debug-token path gave no 401/403 (also confirms 02-HUMAN-SETUP 2.5). |
| A6 | Structured output on-device honours `responseConstraint` for nested object/array schemas of §4.3.4 | **Resolved 2026-11-26**: all four task device JSON Schemas (extract-contract 997 chars with image ~24 s, infer-responsive 465 ~4.5 s, judge 348 ~4.2 s, deep-analysis 514 ~7.1 s) were accepted as `responseConstraint`; outputs passed the kernel zod schemas. No flattening. |
| D1 | CSP origins (reCAPTCHA Enterprise, App Check, AI Logic, Remote Config, Installations, `data:`) | Deploy a preview channel, run a manual Deep Analysis with CSP report-only, collect violations, enforce; then run one real on-device image prompt on the CSP-enforced preview. If the schedule is cut, deploy once with the CSP enforced and run both prompts; any violation → widen `connect-src` only and record an `S#`. **Local part resolved 2026-11-26** (`vite preview` with the exact `SPEC-SEC-08` header, App Check debug provider): on-device image prompt (5.2 s) and cloud call (5.5 s) pass; no `connect-src` or `blob:` change needed. One violation: `script-src` blocked `eval` at load, from zod 4's `allowsEval` probe (`Function('')`, caught and falling back to the non-JIT path). CSP stays unchanged (no `'unsafe-eval'`); remediation is `z.config({ jitless: true })` before the kernel schemas are constructed (task 7.1). Real reCAPTCHA path and zero violations on Hosting: 15.3. |
| I1 | `@vite-pwa/assets-generator` multi-size `favicon.ico` (16 + 32) | Run `npm run icons`; if only one size is emitted, ship 32 px (`SPEC-PWA-01`). |
| O1 | On-device prompt with the network off (PRD-M-07, demo beat 0:20) | With the model available, load the app, go offline, run one `ONLY_ON_DEVICE` image prompt; record success or the failing call. **Resolved 2026-11-26**: with Ethernet disabled and `navigator.onLine` false, an `ONLY_ON_DEVICE` image prompt passed on Gemma 4 in 12.3 s, schema-valid; PRD-M-07 met, demo beat 0:20 can run offline (only console error: the reCAPTCHA script failing to load). Network-off re-run in 14.4. If it fails, the demo keeps the network on for that beat and the README reports PRD-M-07 as not met. |
| T1 | M-08 timings on demo hardware | Time sample extraction and Run; record in README. |
