# 1. Plan and Budget

**[◀ 0. How to Use](00-HOW-TO-USE.md)** · [Roadmap index](../ROADMAP.md) · **[2. Human Setup ▶](02-HUMAN-SETUP.md)**

3 days, ≤ 25 agent-hours, up to 3 parallel workers in git worktrees (PRD-D-14). Step 0 runs alone; lanes A, B, C start at G0.

## Day plan (lane order; times are agent-hours)

| Day | Lane 0 / A | Lane B | Lane C | Gate |
|---|---|---|---|---|
| 1 | Step 0: 3.1–3.7 (3.0) → **G0**; then 4.1, 5.1, 4.2–4.5, 5.2–5.5 (2.5) | 9.1, 9.3, 9.4, 9.2, 8.1, 8.2 (2.35) | 13.1, 11.1, 12.1, 12.3, 11.2 (2.4) | **M1** end of day |
| 2 | 6.1, 6.2; 7.1, 7.2, 7.4 after B's 8.4 (2.75); 7.3 after M3 merges of B and C (0.9) | 8.3, 8.4, 9.5, 10.1–10.4 (3.25) | 11.3, 12.2, 13.2–13.6 (3.5) | **M2** midday, **M3** end of day |
| 3 | 14.0, 14.1, 15.3, 16.1–16.7 (1.55) | 14.4, 14.2 (0.8) | 14.3 after 14.4, 15.1, 15.2 (0.9) | **M4** midday, **M5** end of day |

Human steps (phase 2) run beside Day 1; deploy, Remote Config publish and video on Day 3 (phase 16).

## Budget (agent-hours)

| Phase | Owner | Planned |
|---|---|---|
| 3 Step 0: kernel freeze | 0 | 3.00 |
| 4 VERIFY spikes | A | 0.75 |
| 5 Firebase and AI engine | A | 1.75 |
| 6 Storage and imaging | A | 1.25 |
| 7 App shell and PWA | A | 2.40 |
| 8 Measure | B | 1.75 |
| 9 Snippet and sample | B | 2.00 |
| 10 Run | B | 1.85 |
| 11 Projects and contract | C | 1.80 |
| 12 Settings, deep, export | C | 1.30 |
| 13 UI | C | 2.80 |
| 14 Integration (A 0.55, B 0.8, C 0.4) | A, B, C | 1.75 |
| 15 Polish and a11y (A 0.25, C 0.5) | A, C | 0.75 |
| 16 Release | A | 0.75 |
| **Planned total** | | **23.90** |
| **Buffer** (rework after merges, VERIFY fallbacks, flaky E2E) | | **1.10** |
| **Total** | | **25.00** |

Per lane: 0 = 3.0, A = 7.7, B = 6.4, C = 6.8.

## Critical path

G0 (3.1–3.7) → 9.3–9.4 sample assets → 8.2 snapping → 9.5 verified Contract → 8.3–8.4 → 10.x Run → M3 → 7.3 wiring → 14.0 harness → 14.x E2E → 16 release.

Fit check (wall-clock): Day 1 = 3.0 + 2.5 ≈ 5.5 h. Day 2 = C's 3.5 (longest lane, sets M3) + task 7.3 (0.9) ≈ 4.4 h. Day 3 = A's 1.55 plus human deploy, Remote Config and video. The buffer (1.1 h) absorbs one slipped lane on Day 2; any larger slip goes to [18](18-CUT-LIST.md) at M3.

## Checkpoints

| When | Check | If behind |
|---|---|---|
| G0 later than +3.5 h on Day 1 | Step 0 scope complete? | Do not start lanes on a partial kernel; spend buffer |
| End of Day 1 (M1) | Spike answers recorded; sample assets committed | Apply spike fallbacks; B continues on fixtures |
| End of Day 2 (M3) | `npm run check` green; sample flow reaches Findings | Apply [18](18-CUT-LIST.md) tiers in order; record the decision in the PR |
| Day 3 midday (M4) | E2E green; live smoke done | Ship with documented limits; never drop P0 items 1–11, 13 |
