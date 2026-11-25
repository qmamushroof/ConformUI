# 18. Cut List

**[◀ 17. Demo Script](17-DEMO-SCRIPT.md)** · [Roadmap index](../ROADMAP.md) · **[19. Coverage ▶](19-COVERAGE.md)**

Decided at the M3 checkpoint (end of Day 2) or whenever the buffer is gone. Apply tiers top-down; stop as soon as the plan fits. Record each cut in the PR and in the README limits. PRD §11 rules: only P0 item 12 may be cut; never 1–11 or 13.

## Never cut

PRD §11 items 1–11 and 13. In particular: Firebase AI Logic hybrid with consent-safe mode mapping (`resolveMode`, SPEC-AI-02 guards), Engine badge from `inferenceSource`, App Check, Remote Config, the consent and Deep Analysis confirm sheets, the deterministic engine, the sample, Re-verify, exports, PWA offline shell, README, video, manual deploy.

## Tier 1 — P1: never started (PRD §11 P1, SPEC `[P1]`)

Not in any task above. Drop silently if anyone began them, in this order:

1. Hosted sample pages (PRD-F-10.6, SPEC-DEMO-08)
2. Bookmarklet (PRD-F-13.8)
3. Android share target (PRD-F-02.5, PRD-F-12.3, SPEC-PWA-06)
4. Project rename (PRD-F-01.3)
5. On-device only mode (PRD-H-04, PRD-F-11.3)
6. Tablet and custom width (PRD-F-08.1)
7. Compare any two Runs (PRD-F-07.4)
8. Contract JSON import (PRD-F-09.5)
9. Fix prompt scoping (PRD-F-09.2)
10. Dismiss as accepted deviation (PRD-F-05.5)
11. Findings filters (PRD-F-05.3)
12. Suggested requirements (PRD-P-01)
13. Contract versioning history list (PRD-F-03.5)
14. Region drawing (PRD-F-03.3, PRD-F-03.6)

## Tier 2 — advisory work (pre-approved in the SPEC, S29)

| Drop | Tasks affected |
|---|---|
| Lighthouse scores | 15.3 fourth box (SPEC-PERF-07: advisory and optional) |
| Second preview redeploy | 15.3 deploys once with the CSP enforced and runs both prompts (SPEC §10.2 D1) |
| Precomputed re-record from a real run | 14.4 third box; ship the 9.5 seed labelled "Sample results (pre-computed)" plus the README limits line (SPEC §4.11.2) |

## Tier 3 — optional inside P0 (pre-approved in the SPEC, S29)

| Drop | How | Tasks affected |
|---|---|---|
| Full-page toggle in `ComparisonView` | Keep side-by-side crops, region outlines and Diff overlay (SPEC-UI-01; PRD-F-05.1, PRD-F-05.4 still met) | 13.5 first box, Full page only |

## Tier 4 — PRD §11 item 12 (last resort)

Drop the Settings screen, its mode switch, consent list and Clear all data, and the Onboarding screen (13.2 second box, `/settings` and `/welcome` routes in 7.2, E10 in 14.3; `/` no longer redirects). **Keep** per SPEC-SET-10: `EngineBadge`, the Download model button and `enableSteps` in the Project header, `PrivacyCounter`. Mode stays Auto. Update the demo script: no onboarding shot; Clear data via browser site data.
