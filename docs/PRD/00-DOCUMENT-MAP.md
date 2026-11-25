# 0. Document Map

**(first)** · [PRD index](../PRD.md) · **[1. Product Identity ▶](01-PRODUCT-IDENTITY.md)**

| Document | Owns |
|---|---|
| `docs/PRD.md` + `docs/PRD/` | *What* ConformUI does and *why* — problem, users, scope, principles, hybrid split, features, metrics, risks, decisions. No implementation detail beyond locked decisions (§14). |
| `docs/SPEC.md` + `docs/SPEC/` | *How* it is built — architecture, module boundaries, stack and pinned versions, data contracts, prompts, algorithms, thresholds, edge cases. |
| `docs/ROADMAP.md` + `docs/ROADMAP/` | *In what order* — phased, checklisted build plan with verification per step. |
| `README.md` (repo root) | Public description: what it does, how Firebase AI Logic is used, features, value, setup. |

## Conflict order

1. **Decisions log (§14)** outranks every other text; reversing an entry is an explicit amendment to §14 with its reason.
2. **PRD wins on product intent; SPEC wins on mechanism.** A SPEC contradicting intent is corrected, not the PRD.
3. **ROADMAP never changes scope**; it sequences what §11 and the SPEC define.
4. **Code contradicting the SPEC is a defect**, never a silent redefinition.

## Stable IDs

| Prefix | Meaning | Example |
|---|---|---|
| `PRD-P-xx` | Product principle (§6) | `PRD-P-02` |
| `PRD-H-xx` | Hybrid inference rule (§7) | `PRD-H-03` |
| `PRD-F-xx` / `PRD-F-xx.y` | Feature area / acceptance requirement (§8–§10) | `PRD-F-04.2` |
| `PRD-M-xx` | Success metric (§12) | `PRD-M-05` |
| `PRD-R-xx` | Risk (§13) | `PRD-R-01` |
| `PRD-D-xx` | Decision (§14) | `PRD-D-09` |
| `PRD-Q-xx` | Open question (§15) | `PRD-Q-02` |

IDs are never reused or renumbered. Inside the PRD the `PRD-` prefix may be dropped (e.g. `F-04.2`); SPEC and ROADMAP use the full form.

## Style

- A rule, then its reason in one sentence; tables for parallel facts; one fact, one owner — other sections point, never restate.
- Numbers such as thresholds, sizes and timeouts belong to the SPEC unless stated here as a product commitment.
- Facts to confirm at build time are marked **VERIFY**.
- Open items live only in §15.
