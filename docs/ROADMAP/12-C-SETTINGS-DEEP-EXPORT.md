# 12. Settings, Deep Analysis, Export

**[◀ 11. Projects and Contract](11-C-PROJECTS-CONTRACT.md)** · [Roadmap index](../ROADMAP.md) · **[13. UI ▶](13-C-UI.md)**

| | |
|---|---|
| **Depends on** | G0. Budget 1.3 h, lane C. 12.1, 12.3 Day 1; 12.2 Day 2 |
| **Delivers** | `SettingsService`; `DeepService` + `deep-analysis.v1.md`; export functions |
| **Read** | SPEC §4.12.1–4.12.2, §4.9, §4.10, §9 (S20) |
| **Covers** | SPEC-SET-01..05, SPEC-SET-07, SPEC-DEEP-02..08, SPEC-EXP-01..05, PRD-F-06, PRD-F-09.1, PRD-F-09.3, PRD-F-09.4, PRD-F-11.1..11.4, PRD-D-21, PRD-D-27, PRD §11 items 9, 12 |

Services and pure functions only; UI is 13.2 and 13.6.

### 12.1 SettingsService · C · 0.25 h · needs G0
- [x] `read`, `setMode`, `markOnboarded`; `engine()` → `EngineView` texts and `enableSteps` (SPEC-SET-01, SPEC-SET-02, SPEC-SET-04).
- [x] `downloadModel` only calls `AiEngine.downloadDeviceModel` (SPEC-SET-03); consent list data (SPEC-SET-05); `clearAllData` keeps `deepUsage`, resets mode and onboarding (SPEC-SET-07); `privacy(project)` (SPEC-SET-06 data).

**Accept:** `EngineView` per `EngineStatus` and reason; clear keeps the Deep count.

### 12.2 DeepService · C · 0.55 h · needs 12.1
- [ ] `availability` reasons (SPEC-DEEP-03, SPEC-DEEP-04); `preview` lists images, bytes, counts, model, cap (SPEC-DEEP-02).
- [ ] `run`: one `ONLY_IN_CLOUD` request built only from the preview, deep-scope token required (SPEC-DEEP-05); merge rules (SPEC-DEEP-06); failures leave the Run unchanged (SPEC-DEEP-07); `prompts/deep-analysis.v1.md` (SPEC-DEEP-08); count increments on send.
- [ ] `applyPrecomputed(run, deep)`: same SPEC-DEEP-06 merge with `origin:'precomputed'`, no request, no count (SPEC-DEMO-05).

**Accept:** request images and bytes equal the preview list; `pass` removes a Finding; measured numbers and Inferred cap unchanged; unknown ids ignored; trace gains a `deep` Cloud step; cap boundary test; `applyPrecomputed` makes zero `ai.run` calls and labels every merged item pre-computed.

### 12.3 Export functions · C · 0.5 h · needs G0
- [ ] `fixPrompt` template, order and determinism (SPEC-EXP-01, S20); `contractMarkdown`/`contractJson` (SPEC-EXP-02); `reportMarkdown`/`reportJson` (SPEC-EXP-03, SPEC-EXP-04); `fileName`.
- [ ] Source-tag walk and zod validation before download (SPEC-EXP-05).

**Accept:** two calls byte-identical; passing items absent; needs-review "verify first"; JSON round-trip through zod; source-tag walk (PRD-M-03). Snapshot tests on the sample flawed Run are added in 14.3, after the 14.4 re-record.

## Exit gate

- `npm run check:fast` green; `export` has no UI and no I/O; `deep-analysis` imports kernel only. 12.1, 12.3 merged at M1; 12.2 at M3.
