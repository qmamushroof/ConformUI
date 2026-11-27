# 14. Integration

**[◀ 13. UI](13-C-UI.md)** · [Roadmap index](../ROADMAP.md) · **[15. Polish and A11y ▶](15-POLISH-A11Y.md)**

| | |
|---|---|
| **Depends on** | Milestones below. 14.0 and 14.4 need M3; 14.1–14.3 need 14.0. Budget 1.75 h (A 0.55, B 0.8, C 0.4), Day 3 morning |
| **Delivers** | Merge order per milestone; shared E2E harness; E2E E1–E11 and E13 green; live smoke with real engines; precomputed sample results re-recorded where they match |
| **Read** | SPEC §7.2, §7.5, §7.7, §4.11.2, §10.2 (O1, T1) |
| **Covers** | SPEC-TEST-01..03, SPEC-SEC-02, SPEC-SNIP-07 (runtime), SPEC-DEMO-05, SPEC-PERF-01, SPEC-PERF-02, SPEC-PERF-06, PRD-M-01..10, PRD-M-12..14 |

## Milestones and merge order

Within a milestone, merge in the order listed; each lane rebases on `main` and runs `npm run check:fast` before its merge. Low-dependency work first, `app` last.

| Gate | When | Merge order | Gate check |
|---|---|---|---|
| **G0** | Day 1, +3.0 h | lane 0: 3.1–3.7 | [03](03-KERNEL-FREEZE.md) gate |
| **M1** | Day 1 end | B: 9.1–9.4, 8.1–8.2 → C: 13.1, 11.1–11.2, 12.1, 12.3 → A: 4.1, 5.1–5.5 (+ spike records) | `check:fast` green; sample assets committed; spike answers or fallbacks recorded |
| **M2** | Day 2 midday | B: 8.3–8.4, 9.5 → C: 11.3, 13.2–13.4 → A: 6.1–6.2, 7.1–7.2, 7.4 | e2e build boots; routes render; `loadSampleAssets` resolves; verified Contract snaps within 2 px |
| **M3** | Day 2 end | B: 10.1–10.4 → C: 12.2, 13.5–13.6 → A: 7.3 | `npm run check` green; sample acceptance (SPEC-TEST-03) green; Try the sample → Run → Findings on the e2e build; cut checkpoint ([18](18-CUT-LIST.md)) |
| **M4** | Day 3 midday | 14.0 → 14.4 → 14.1–14.3, 15.1–15.2 | E2E E1–E13 green in CI; live smoke recorded → release candidate |
| **M5** | Day 3 end | 15.3, 16.x | deployed, Remote Config published, README complete, video linked |

## Tasks

### 14.0 E2E harness · A · 0.15 h · needs M3
- [x] `tests/e2e/fixtures.ts`: e2e build + preview, `window.__CUI_FAKE__` scenarios of SPEC §7.2, network spy on `*.googleapis.com`, helpers to read `calls[]`. Other lanes import it, never edit it.

**Accept:** the 3.7 smoke spec runs through the fixture; spy records zero AI requests on it.

### 14.1 E1, E2, E3, E11 · A · 0.4 h · needs 14.0
- [ ] E1 (2 clicks to Findings, both device scenarios), E2 (offline on-device extract + Run, 0 bytes), E3 (consent sheet, zero calls before Allow, Decline path), E11 (manifest, installability, offline second load ≤ 1 s) per SPEC §7.5.
- [ ] E3 also on a sample Project: Extract with device `unavailable` opens the consent sheet (SPEC-DEMO-05); Decline shows the pre-computed extraction labelled.

**Accept:** specs green; titles cite PRD-M-13, PRD-M-04, PRD-M-06, PRD-H-05, PRD-M-12, SPEC-PERF-06.

### 14.2 E4, E5, E6, E7 · B · 0.4 h · needs 14.0
- [x] E4 Deep Analysis, E5 Re-verify "6 resolved, 1 remaining", E6 exports (copy and download), E7 snippet on `sample-site/flawed/` at 390 px, opened via `file://` or a `page.route` static serve (zero network requests, no form value or cookie in output, SPEC-SNIP-07 runtime).

**Accept:** specs green; PRD-F-06, PRD-F-07.2, PRD-F-09, PRD-F-13 cited.

### 14.3 E8, E9, E10, E13, export snapshots · C · 0.4 h · needs 14.0, 14.4
- [ ] E8 inputs (picker, drop, paste, error copy, viewport suggestion and change), E9 projects persist and cascade delete, E10 settings (mode, revoke → asks again, clear data, download from click), E13 every `ErrorCode` copy.
- [ ] Snapshot tests of `fixPrompt` and `reportMarkdown` on the sample flawed Run (SPEC §4.10.4), taken after the 14.4 re-record.

**Accept:** specs green; PRD-F-01, PRD-F-02, PRD-F-11, SPEC-UI-05, SPEC-EXP-01 cited.

### 14.4 Live smoke and precomputed re-record · B · 0.4 h · needs M3, 2.8
- [ ] Demo machine, dev build with real Firebase: Try the sample → Extract contract (on-device) → Run → Deep Analysis (cloud). Record `inferenceSource` per call; both values observed.
- [ ] Record: AI-vs-verified match count (PRD-M-14), extraction time (SPEC-PERF-02), deterministic Run stages (SPEC-PERF-01, PRD-M-08, VERIFY T1), network-off extract + Run (PRD-M-07, VERIFY O1), image add time (SPEC-PERF-03).
- [ ] Re-record `extraction` and `deep` in `src/features/demo/sample/precomputed/` from this run. For `flawed`/`fixed` Judged items, replace the seed only when the live verdict matches PRD-M-01/02; otherwise keep the seed and note it in the README limits (SPEC §4.11.2). Rerun sample acceptance.
- [ ] Manual defect 7 check: Judged result is Needs review on flawed, Resolved on fixed (PRD-M-01, PRD-M-02 manual part).

**Fallback:** on-device not ready → record cloud results after consent (labelled Cloud), keep the seed for on-device-dependent fields, and list the gap in the README limits.
**Accept:** results table saved for the README (16.2); `npm run check` green after the re-record.

## Exit gate (M4)

- `npm run check` green in CI with E1–E11 and E13 (E12 in 15.1); network spy shows zero AI requests before consent in every spec (SPEC-SEC-02).
