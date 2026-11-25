# Roadmap — ConformUI

Build order for release 1 (PRD §11 P0). *What*: `docs/PRD.md`. *How*: `docs/SPEC.md`. This plan sequences; it never changes scope or contracts.

| Phase | Name | Delivers | Owner | Agent-h | File |
|---|---|---|---|---|---|
| — | How to use | Task format, loop, definition of done, ownership, merge and VERIFY rules | — | — | [00-HOW-TO-USE.md](ROADMAP/00-HOW-TO-USE.md) |
| — | Plan and budget | Day plan, lanes, budget table, critical path | — | — | [01-PLAN-BUDGET.md](ROADMAP/01-PLAN-BUDGET.md) |
| 2 | Human setup | Firebase project, AI Logic, App Check, Hosting, demo devices, branch protection | Human | 0 | [02-HUMAN-SETUP.md](ROADMAP/02-HUMAN-SETUP.md) |
| 3 | Step 0: kernel freeze | Toolchain, module table, skeletons, kernel, architecture tests, test seam, CI | 0 | 3.0 | [03-KERNEL-FREEZE.md](ROADMAP/03-KERNEL-FREEZE.md) |
| 4 | VERIFY spikes | Icons, on-device flag, image size, schemas, cloud models, offline (O1), CSP (local) | A | 0.75 | [04-SPIKES.md](ROADMAP/04-SPIKES.md) |
| 5 | Firebase and AI engine | `initFirebase`, Remote Config, hybrid adapter, guards, status, download | A | 1.75 | [05-A-FIREBASE-AI.md](ROADMAP/05-A-FIREBASE-AI.md) |
| 6 | Storage and imaging | IndexedDB adapter, image codec | A | 1.25 | [06-A-STORAGE-IMAGING.md](ROADMAP/06-A-STORAGE-IMAGING.md) |
| 7 | App shell and PWA | Composition root, routes, flow wiring, sample fallbacks, manifest, icons, service worker | A | 2.4 | [07-A-APP-PWA.md](ROADMAP/07-A-APP-PWA.md) |
| 8 | Measure | Deterministic engine | B | 1.75 | [08-B-MEASURE.md](ROADMAP/08-B-MEASURE.md) |
| 9 | Snippet and sample | DOM snippet, sample site, captures, demo feature | B | 2.0 | [09-B-SNIPPET-SAMPLE.md](ROADMAP/09-B-SNIPPET-SAMPLE.md) |
| 10 | Run | Check handlers, Run procedure, Findings, Re-verify, sample acceptance | B | 1.85 | [10-B-RUN.md](ROADMAP/10-B-RUN.md) |
| 11 | Projects and contract | Projects service, extraction, Inferred items, review, lock | C | 1.8 | [11-C-PROJECTS-CONTRACT.md](ROADMAP/11-C-PROJECTS-CONTRACT.md) |
| 12 | Settings, deep, export | Settings service, Deep Analysis service, exports | C | 1.3 | [12-C-SETTINGS-DEEP-EXPORT.md](ROADMAP/12-C-SETTINGS-DEEP-EXPORT.md) |
| 13 | UI | Tokens, copy, every screen and component | C | 2.8 | [13-C-UI.md](ROADMAP/13-C-UI.md) |
| 14 | Integration | Milestones, merge order, E2E harness, E1–E11 and E13, live smoke | A, B, C | 1.75 | [14-INTEGRATION.md](ROADMAP/14-INTEGRATION.md) |
| 15 | Polish and a11y | Axe (E12), manual a11y, CSP on Hosting, performance check | A, C | 0.75 | [15-POLISH-A11Y.md](ROADMAP/15-POLISH-A11Y.md) |
| 16 | Release | LICENSE, README, manual deploy, Remote Config publish, submission | A, Human | 0.75 | [16-RELEASE.md](ROADMAP/16-RELEASE.md) |
| — | Demo script | Video script ≤ 3 min (PRD §10) | Human | — | [17-DEMO-SCRIPT.md](ROADMAP/17-DEMO-SCRIPT.md) |
| — | Cut list | What to drop, in order, if behind | — | — | [18-CUT-LIST.md](ROADMAP/18-CUT-LIST.md) |
| — | Coverage | PRD §11 items, PRD metrics and SPEC areas to tasks | — | — | [19-COVERAGE.md](ROADMAP/19-COVERAGE.md) |

**Budget:** 23.9 agent-hours planned + 1.1 buffer = **25.0**. Three days, up to 3 parallel workers after the Step 0 gate.

| Day | Work | Gate |
|---|---|---|
| Day 1 | Step 0 (one worker) → G0; then A, B, C in parallel worktrees | M1 at end of day |
| Day 2 | A, B, C in parallel | M2 midday, M3 end of day (feature complete; cut checkpoint) |
| Day 3 | E2E, live smoke, polish, a11y, release, video | M4 release candidate, M5 submitted |
