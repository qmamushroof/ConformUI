# 1. Document Identity

**(first)** · [SPEC index](../SPEC.md) · **[2. Stack ▶](02-STACK.md)**

## 1.1 What the SPEC owns

HOW ConformUI is built: stack, architecture, module contracts, data shapes, algorithms, thresholds, prompts, budgets, tests, deploy. WHAT and WHY live in the PRD; the SPEC cites PRD IDs in full form (`PRD-F-04.5`, `PRD-H-04`, `PRD-D-18`) and never restates intent.

## 1.2 Conflict order

1. PRD Decisions Log (`PRD-D-*`) outranks everything.
2. PRD wins on intent; SPEC wins on mechanism. A SPEC rule contradicting PRD intent is corrected in the SPEC.
3. ROADMAP sequences work; it never changes scope or contracts.
4. Code contradicting the SPEC is a defect. Change the SPEC first, then the code, in the same change.
5. **VERIFY** = must be confirmed at build time. Each VERIFY names a spike step. The agent runs it, records the result as a code comment `// SPEC-AI-05 verified 2026-MM-DD: …`, and amends the SPEC if it differs. Open VERIFY items: §10.2.

## 1.3 Requirement IDs

Format `SPEC-<AREA>-<NN>`: two digits, stable, never reused or renumbered. A rule is one table row, bullet, heading or numbered step tagged with its ID.

| Area | § | Area | § |
|---|---|---|---|
| `STACK` | 2 | `RUN` | 4.8 |
| `ARCH` | 3 | `DEEP` | 4.9 |
| `KERNEL` | 4.1 | `EXP` | 4.10 |
| `FB` | 4.2 | `DEMO` | 4.11 |
| `AI` | 4.3 | `SET` | 4.12 |
| `MEAS` (incl. imaging) | 4.4 | `APP` / `PWA` | 4.13 |
| `SNIP` | 4.5 | `UI` | 5 |
| `PROJ` / `STORE` | 4.6 | `SEC` / `PERF` | 6 |
| `CON` | 4.7 | `TEST` / `DEPLOY` | 7 / 8 |

Decisions use `S#` (§9). Tests cite IDs in their titles (`it('SPEC-MEAS-07: snaps a suggested region to element bounds', …)`, §7.6).

## 1.4 Scope tiers

| Tier | Meaning |
|---|---|
| **P0** | Ships in release 1 (PRD §11). Default for any rule with no tag. |
| **[P1]** | Built only after all P0 items are done (PRD §11). Specified so P0 code leaves room for it; do not start early. |
| **[Later]** | Not release 1. Specified only where it constrains P0 design (extension points). Must not be implemented. |

Cut order follows PRD §11 (only item 12 may be cut; the Engine badge, Download-model button, flag steps and privacy counter stay).

## 1.5 Changing the SPEC

- Edit the owning leaf; add an `S#` row in §9 for any decision that reverses or narrows an earlier one.
- Docs do not name the third-party tools used to build the app (PRD-D-15).
- Each leaf stays near or under ~120 lines; split by module, not by length.
