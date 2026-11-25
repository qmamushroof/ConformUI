# 19. Coverage

**[◀ 18. Cut List](18-CUT-LIST.md)** · [Roadmap index](../ROADMAP.md) · **(last)**

Every P0 item and metric has a task (after the S29 amendments). Gaps found here are fixed by adding a task, not by changing scope.

## PRD §11 P0 items to tasks

| # | Item | Tasks |
|---|---|---|
| 1 | AI Logic hybrid, Engine badge, App Check, Remote Config | 2.2–2.5, 3.5, 3.6, 4.2–4.5, 5.1–5.5, 7.1, 13.2, 14.4, 16.4 |
| 2 | Projects, local storage, image inputs per viewport | 3.5 (`suggestViewport`), 6.1, 6.2 (`probe`), 11.1, 13.3, 7.3 (Project route), 14.3 |
| 3 | Contract extraction, snapping, review | 8.2, 11.2, 11.3, 13.4 |
| 4 | Deterministic engine, Verification Run, engine trace | 8.1–8.4, 10.1, 10.2, 13.5 (stage progress) |
| 5 | Findings with evidence, sort, confidence, fix, condition | 10.3, 13.5 |
| 6 | Demo sample | 9.3–9.5, 13.6, 7.3 (sample wiring and SPEC-DEMO-05 fallbacks), 14.1 (sample E3), 14.4 |
| 7 | Re-verify, Run history | 10.4, 13.5, 14.2 |
| 8 | DOM snippet and snapshot-based Measured checks | 9.1, 9.2, 9.4, 13.3, 14.2 |
| 9 | Deep Analysis, Fix prompt, Markdown/JSON export | 12.2, 12.3, 13.6, 7.3 (Run → Deep → export), 14.2, 14.3 (snapshots) |
| 10 | Installable PWA, offline shell | 4.1, 7.4, 14.1, 16.3 |
| 11 | Multi-viewport with Inferred labelling | 11.3, 10.1, 10.3 |
| 12 | Settings panel, privacy counter, onboarding | 12.1, 13.2, 7.3 (revoke, `everSentToCloud`), 14.3 |
| 13 | Accessible UI, README, video, manual deploy, Remote Config publish | 13.1, 15.1, 15.2, 16.1–16.7, 17 |

## PRD §12 metrics to proof

| Metric | Proof |
|---|---|
| PRD-M-01, PRD-M-02 | 10.4 (automated, defects 1–6), 14.4 (manual, defect 7) |
| PRD-M-03 | 8.3, 10.3, 12.3 |
| PRD-M-04 | 13.2, 14.1 |
| PRD-M-05 | 5.4, 10.3 |
| PRD-M-06 | 3.5, 11.2, 10.2, 7.3, 14.1 |
| PRD-M-07 | 4.4, 14.4 |
| PRD-M-08 | 14.4 |
| PRD-M-09 | 8.4, 10.4 |
| PRD-M-10 | 10.3, 11.3 |
| PRD-M-11 | 15.1 |
| PRD-M-12 | 14.1, 16.3 |
| PRD-M-13 | 7.3, 14.1 |
| PRD-M-14 | 14.4 |

## SPEC areas to tasks

| SPEC area | Tasks | SPEC area | Tasks |
|---|---|---|---|
| `STACK`, `ARCH` | 3.1–3.3 | `DEEP` | 12.2, 13.6 |
| `KERNEL` | 3.4, 3.5 (incl. SPEC-KERNEL-12) | `EXP` | 12.3 |
| `FB` | 5.1 (SPEC-FB-01..08), 2.4, 2.5 | `DEMO` | 9.3–9.5, 13.6, 7.3 |
| `AI` | 3.6, 4.x, 5.2–5.5 | `SET` | 12.1, 13.2 |
| `MEAS` | 6.2, 8.x, 11.1 | `APP`, `PWA` | 7.x, 4.1 |
| `SNIP` | 9.1, 9.2, 13.3, 14.2 | `UI` | 13.x, 15.1, 15.2 |
| `PROJ`, `STORE` | 11.1, 6.1 | `SEC`, `PERF` | 3.1, 3.7, 15.3, 14.x |
| `CON` | 11.2, 11.3, 13.4 | `TEST` | 3.6, 3.7, 10.4, 14.0–14.4 |
| `RUN` | 10.x, 13.5 | `DEPLOY` | 2.x, 3.7, 16.x |

## SPEC §10.2 VERIFY items to spikes

| Item | Task | Fallback in |
|---|---|---|
| A1 | 4.2 | 4.2 |
| A2, A6 | 4.3 | 4.3 |
| A3, A4 | 4.4 | 4.4 |
| D1 | 4.5 (local), 15.3 (Hosting) | 4.5, 15.3 |
| I1 | 4.1 | 4.1 |
| T1 | 14.4 | 14.4 |
| O1 | 4.4, 14.4 | 4.4 |
