# 4. VERIFY Spikes

**[◀ 3. Step 0: Kernel Freeze](03-KERNEL-FREEZE.md)** · [Roadmap index](../ROADMAP.md) · **[5. Firebase and AI Engine ▶](05-A-FIREBASE-AI.md)**

| | |
|---|---|
| **Depends on** | G0. 4.1 needs nothing else; 4.2–4.5 need 5.1 and human 2.2–2.5, 2.8. Budget 0.75 h, lane A, Day 1 |
| **Delivers** | Answers to SPEC §10.2 A1, A2, A3, A4, A6, I1, O1 and D1 (local part); each recorded or replaced by its fallback |
| **Read** | SPEC §4.3.2, §10.2, §4.13.3 (SPEC-PWA-01), §6.2 (SPEC-SEC-08), [00](00-HOW-TO-USE.md) VERIFY rule |
| **Covers** | SPEC-AI-07, SPEC-AI-11, SPEC-AI-05 (device schemas), SPEC-SET-02, SPEC-PWA-01, SPEC-SEC-08 (local), PRD-R-13 |

Live spikes run on the demo machine (2.8) from a throwaway branch `spike/hybrid` (never merged) with a scratch page that calls `initFirebase` and `firebase/ai` directly. Only the recorded answers, SPEC edits and fallback code reach `main`. If human setup is not ready on Day 1, run 4.2–4.5 first thing Day 2; lane A continues on mocks meanwhile.

### 4.1 I1: multi-size favicon.ico · A · 0.1 h · needs G0
- [x] `pwa-assets.config.ts` per SPEC-PWA-01; run `npm run icons`; inspect the `.ico` for 16 and 32 px entries.
- [x] Record `// SPEC-PWA-01 verified <date>: …` in `pwa-assets.config.ts`.

**Fallback:** one size emitted → ship 32 px (SPEC-PWA-01). No `.ico` at all → ship the SVG favicon link plus the ≥ 48 px PNGs and amend SPEC-PWA-01.
**Accept:** generated files committed; record present.

### 4.2 A1: on-device image availability and flag · A · 0.2 h · needs 5.1, 2.5, 2.8
- [ ] With the flag on and off: log `LanguageModel.availability({ expectedInputs: [{ type: 'image' }] })` (value or throw).
- [ ] Run one `ONLY_ON_DEVICE` image prompt through the hybrid model.
- [ ] Record at the SPEC-AI-07 code site; amend SPEC-AI-07 / SPEC-SET-02 if the signal or flag set differs.

**Fallback:** no reliable signal → `deviceImage: 'unknown'`, always show `enableSteps` on desktop Chrome, and Judged checks run text-only from the DOM snapshot (SPEC §4.8.2 step 3).
**Accept:** record present; status mapping test in 5.5 uses the observed values.

### 4.3 A2 + A6: image size and on-device structured output · A · 0.2 h · needs 4.2
- [ ] A2: one 1024 px JPEG band + prompt, then two images in one prompt; note success, latency, any token-limit error.
- [ ] A6: each of the four task schemas (SPEC §4.3.4) once on-device with `responseConstraint`.
- [ ] Record at the SPEC-AI-11 and `schemaFor` code sites.

**Fallback:** token error at 1024 → on-device max side 768 (SPEC-AI-11). Schema rejected → flatten that task's device JSON Schema in `schemaFor`; zod stays the authority (SPEC-AI-05). Multi-image is not needed (S11).
**Accept:** records present; SPEC edits made where answers differ.

### 4.4 A4 + A3 + O1 (offline on-device) · A · 0.15 h · needs 4.2
- [ ] A4: one `ONLY_IN_CLOUD` call per default model id (`cloud_first_pass_model`, `deep_model`).
- [x] A3: answered 2026-11-26 (PRD-D-33, SPEC §10.2): the on-device model is Gemma 4; Event Logs show "Loading model [gemma4_gpu_high_tier_model] on backend [GPU]". Note this in the README (16.2).
- [ ] O1 (SPEC §10.2): load the scratch page, switch the network off, run one `ONLY_ON_DEVICE` image prompt (demo beat 0:20, PRD-M-07).

**Fallback:** a model id unavailable → pick the nearest listed id; change `DEFAULT_RUNTIME_VALUES` + `remoteconfig.template.json` + SPEC §4.1.6 in one kernel-change commit ([00](00-HOW-TO-USE.md)). Offline call fails → record the cause; the demo keeps the network on for beat 0:20 and shows the trace with 0 bytes; PRD-M-07 is reported as not met in the README.
**Accept:** records present.

### 4.5 D1 (local): on-device image prompt under the enforced CSP · A · 0.1 h · needs 4.2
- [ ] On the spike branch only: `vite preview` serving the SPEC-SEC-08 CSP as a response header.
- [ ] Run one on-device image prompt and one cloud call; collect console CSP violations.

**Fallback:** violation on the image part → add `blob:` to `connect-src`; still blocked → widen only `connect-src`, record an `S#` and amend SPEC-SEC-08. Final proof on Hosting is 15.3.
**Accept:** zero violations, or the amended CSP recorded for 15.3.

## Exit gate

- Every spike has a `// SPEC-… verified` record or an applied fallback with its SPEC edit.
- Remaining VERIFY: D1 on Hosting (15.3), T1 timings and O1 network-off run (14.4).
