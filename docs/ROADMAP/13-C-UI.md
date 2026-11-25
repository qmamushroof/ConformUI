# 13. UI

**[◀ 12. Settings, Deep, Export](12-C-SETTINGS-DEEP-EXPORT.md)** · [Roadmap index](../ROADMAP.md) · **[14. Integration ▶](14-INTEGRATION.md)**

| | |
|---|---|
| **Depends on** | G0. Budget 2.8 h, lane C. 13.1 Day 1; 13.2–13.6 Day 2 |
| **Delivers** | Tokens, copy, `StateNotice`, every screen and component of SPEC §5.1 under `src/features/*/ui/` |
| **Read** | SPEC §5, §4.12 (components), §4.5.1, §4.7.5, §4.8.1, §4.9, §4.11.1, §6.2 (SPEC-SEC-06), §9 (S10, S13) |
| **Covers** | SPEC-UI-01..06, SPEC-PROJ-03, SPEC-PROJ-04, PRD-F-02.3, PRD-F-04.4, SPEC-SET-06, SPEC-SET-08..10, SPEC-DEEP-01, SPEC-SEC-06, PRD-P-06, PRD-P-08, PRD-P-12, PRD-F-05.4, PRD-F-11.5, PRD-F-12.2, PRD-F-13.1, PRD §11 items 12, 13 |

Components take services and data as props; navigation is a callback prop (SPEC-ARCH-07). No free-text chat input anywhere (PRD-P-08). Component tests in `tests/component/`.

### 13.1 Tokens, copy, StateNotice · C · 0.4 h · needs G0
- [ ] `app/styles/tokens.css` + `@theme` per SPEC-UI-02; light/dark by `prefers-color-scheme` (S10).
- [ ] `tests/unit/contrast.test.ts` (SPEC-UI-03); grep test: no hex literal in `src/**/*.{ts,tsx,css}` except `app/styles/tokens.css`.
- [ ] `app/copy.ts`: every string of SPEC §5.4, privacy statement (PRD §6); `StateNotice` keyed by `ErrorCode`/reason (SPEC-UI-05).
- [ ] `copy.ts` also holds the SPEC-APP-02/03/06 and SPEC-PWA-05 strings (header pills, error screen, "Configuration error", update toast, not found); A imports them.

**Accept:** contrast test green and fails when a token drops below its ratio; one component test per `ErrorCode` copy.

### 13.2 Settings UI and shared badges · C · 0.4 h · needs 12.1, 13.1
- [ ] `EngineBadge` (SPEC-SET-09), `PrivacyCounter` (SPEC-SET-06), `EnginePanel` with progressbar and copyable enable steps, `ConsentSheet` (Cancel default focus, focus trap, Esc, passes the click event up).
- [ ] `SettingsScreen` (mode radios, consent list with Revoke, Clear all data confirm) and `OnboardingScreen` (SPEC-SET-08); cut boundary per SPEC-SET-10.

**Accept:** badge text + icon + `aria-label` per engine and origin (PRD-M-04); progressbar values; counter states; sheet focus behaviour.

### 13.3 Projects, Project page, snippet UI · C · 0.4 h · needs 11.1, 13.1
- [ ] `ProjectsScreen` (cards, empty state), `ProjectInputs` with stepper and per-viewport columns, `ImageDropZone` (button, picker, drop, paste; formats and limits printed) (SPEC §5.1, SPEC-PROJ-01, SPEC-PROJ-02).
- [ ] Viewport select prefilled from `suggestViewport`, changeable before save (SPEC-PROJ-03, PRD-F-02.3); stale notice "Captures changed — Re-verify" per viewport (derived: latest Run `captureIds` ≠ current capture) (SPEC-PROJ-04).
- [ ] `SnippetPanel` (code block, Copy, 3 steps, privacy line) and `SnapshotPasteField` (errors, "Use anyway") (PRD-F-13.1, SPEC-SNIP-08).

**Accept:** drop zone is a keyboard-operable button; each input path calls the service; viewport can be changed before save; stale notice only on the replaced viewport; invalid snapshot shows ≤ 5 messages.

### 13.4 Contract UI · C · 0.4 h · needs 11.3, 13.2
- [ ] `ContractScreen`: Extract (disabled without design, hint), band progress, table grouped by viewport, region outlines on the design (dashed when unresolved), Accept all / row actions, Add form, Export buttons (SPEC-CON-07, SPEC-CON-08).
- [ ] Sample comparison panel: "AI proposed N requirements; M match the verified contract", Use AI / Keep verified (SPEC-DEMO-03).

**Accept:** each row shows label text + icon and `EngineBadge`; hover/focus highlights its region; comparison counts.

### 13.5 Run UI · C · 0.9 h · needs 10.3 on `main` or its fixture Run, 13.2
- [ ] `RunScreen` (summary bar, re-verify line, viewport tabs, actions), `FindingList` (sorted, Up/Down/Enter), `FindingDetail`, `ComparisonView` (side by side, Diff overlay `aria-pressed`, Full page, `?f=`), `EngineTrace`, `RunHistory` (SPEC-UI-01, SPEC-UI-04, PRD-F-05.4).
- [ ] Per-stage progress list (`RunEvent` `stage`, `role="progressbar"`) (PRD-F-04.4).
- [ ] Passing / Not checked lists with reasons; run-complete `aria-live` announcement; crop `alt` text (SPEC-UI-06).

**Accept:** keyboard selection test; overlay toggle state; status and severity never colour-only (icon + text); Not checked shows its reason.

### 13.6 Deep and demo UI · C · 0.3 h · needs 12.2, 13.5
- [ ] `DeepAnalysisButton` with disabled reasons; `DeepConfirmSheet` listing the preview; Send mints consent from the trusted click (SPEC-DEEP-01, SPEC-DEEP-02).
- [ ] `TrySampleButton`, `SampleBanner` ("Sample results (pre-computed)" + "Allow cloud to judge live"), `LoadFixedButton` (SPEC-DEMO-02, SPEC-DEMO-04, SPEC-DEMO-05); "Refined by Cloud" label.

**Accept:** synthetic click (`isTrusted:false`) cannot mint; Cancel focused; offline and cap reasons shown (PRD-F-06.3).

## Exit gate

- `npm run check:fast` green; no `dangerouslySetInnerHTML`; no hex outside tokens. 13.1 merged at M1; 13.2–13.4 at M2; 13.5–13.6 at M3.
