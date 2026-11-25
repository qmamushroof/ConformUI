# 11. Release Scope

**[◀ 10. Demo](10-DEMO.md)** · [PRD index](../PRD.md) · **[12. Success Metrics ▶](12-SUCCESS-METRICS.md)**

Release 1 is built by AI coding agents in 3 days (about 25 agent-hours) and demoed. P0 is the cut line.

**Cut order if time runs out: item 12 only. Never cut 1–11 or 13.** P1 sub-requirements are never started before all P0 items are done. Details the SPEC marks optional or advisory inside an item (SPEC S29) may be dropped without cutting the item.

## P0 — ships in release 1

| Order | Item | Refs |
|---|---|---|
| 1 | Firebase AI Logic hybrid (consent-safe mode mapping, Engine badge from inference source) + App Check + Remote Config | §7, D-06, D-11, D-17 |
| 2 | Projects, local storage, image inputs per viewport | F-01, F-02 |
| 3 | Contract extraction (on-device first), region snapping, Contract review (accept, edit text, delete, add) | F-03 |
| 4 | Deterministic engine (alignment, region diff, geometry) and Verification Run with engine trace | F-04, P-02 |
| 5 | Findings with evidence, severity sort, confidence, fix, condition | F-05 |
| 6 | Demo sample: design, flawed and fixed pages committed, DOM snapshots, committed sample Contract, pre-computed fallback | F-10 |
| 7 | Re-verify with Resolved / Remaining / New / Regressed; Run history list | F-07 |
| 8 | DOM snippet (console) and snapshot-based Measured checks | F-13 |
| 9 | Deep Analysis with confirm sheet; Fix prompt; Markdown/JSON export | F-06, F-09 |
| 10 | Installable PWA, offline shell | F-12.1 |
| 11 | Multi-viewport Desktop + Mobile with Inferred labelling | F-08 |
| 12 | Engine settings panel (mode switch, flag enable guide, consent revoke, clear data), privacy counter and onboarding screen | F-11, F-12.2 |
| 13 | Accessible, polished UI; README (what, how AI Logic is used, features, value, setup); demo video; manual Firebase Hosting deploy (`firebase deploy --only hosting`; no CI deploy) and manually published Remote Config template | P-12, §10, §12 |

If item 12 is cut, the Engine badge (item 1), a Download-model button, the flag enable steps and the privacy counter remain.

## P1 — if P0 is complete

| Item | Refs |
|---|---|
| Region drawing/adjusting | F-03.3, F-03.6 |
| Contract versioning with history | F-03.5 |
| Suggested requirements | P-01, §7 |
| Findings filters | F-05.3 |
| Dismiss as accepted deviation | F-05.5 |
| Fix prompt scoping | F-09.2 |
| Contract JSON import | F-09.5 |
| Compare any two Runs | F-07.4 |
| Tablet viewport and custom width | F-08.1 |
| On-device only mode | H-04, F-11.3 |
| Project rename | F-01.3 |
| Android share target | F-02.5, F-12.3 |
| Bookmarklet form of the DOM snippet | F-13.8 |
| Hosted sample pages with snippet instructions | F-10.6 |

## Later (not release 1)

| Item | Note |
|---|---|
| Chrome extension from the same codebase (second composition root) | First follow-up (D-03); could capture screenshots and DOM snapshots directly |
| Component-level contracts and design-token import | Needs design-file access |
| Multiple pages per Project | Excluded for release 1 (D-12) |
| Shareable report links | Needs storage; adds privacy surface |
| Multi-language UI | |

Never in release 1: Figma OAuth/API, GitHub/CI integration, autonomous code modification, crawling, multi-page testing, live-URL or remote Playwright capture, collaboration, accounts (D-12).
