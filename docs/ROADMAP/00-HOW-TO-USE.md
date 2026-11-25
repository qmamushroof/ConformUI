# 0. How to Use

**(first)** · [Roadmap index](../ROADMAP.md) · **[1. Plan and Budget ▶](01-PLAN-BUDGET.md)**

Executed by coding agents in 3 days. Read this leaf, then only your current phase leaf and the SPEC leaves it cites. The ROADMAP orders work; it never changes WHAT (PRD) or HOW (SPEC) (PRD §0 conflict order).

## Task format

```
### <phase>.<n> Title · <owner> · <estimate> h · needs <IDs or gates>
- [ ] checklist item
**Accept:** tests and IDs that prove it
```

- **ID** `<phase>.<n>`, stable, never reused. **Owner**: `0` (Step 0 worker), `A`, `B`, `C` or `Human`. **Estimate** in agent-hours. **needs** = task IDs or gates (`G0`, `M1`…`M5`, 14) that must be merged first.
- **Accept** cites SPEC/PRD IDs; it does not restate them. Read the cited rows.

## Task loop

1. Read the SPEC rows the task cites.
2. Write failing tests first; each title starts with the IDs it proves (`it('SPEC-RUN-10, PRD-F-07.2: …')`, SPEC-TEST-04).
3. Implement the smallest code that passes, only in paths your lane owns.
4. Run `npm run check:fast` (biome ci, `tsc -b`, depcruise + architecture tests, vitest). From M3 on also `npm run check`.
5. Tick boxes (`- [x]`), commit with the task ID in the message, push the worktree branch.

## Definition of done (every task)

- All boxes ticked; every **Accept** item green; test titles cite the IDs.
- `npm run check:fast` green; no `.only`, no skipped tests, no `console.*` except SPEC-SEC-04.
- No file touched outside the lane's paths (table below), except a recorded kernel change.
- VERIFY answers recorded (below). Behaviour that differs from the SPEC: edit the SPEC row first, same commit (SPEC §1.5).
- Docs and code never name the third-party tools used to build the app (PRD-D-15) and never contain personal details. The sample is unbranded: "Sample landing page", "Sample Co." (S28).

## Ownership (SPEC-ARCH-11, S27)

| Lane | Owns |
|---|---|
| 0 | Everything in Step 0 (phase 3); then hands over |
| A | `src/platform/*`, `src/app/**` except `app/styles/` and `app/copy.ts`; `firebase.json`, `.firebaserc`, `remoteconfig.template.json`, `pwa-assets.config.ts`, `public/`, `index.html`, `scripts/check-size.mjs`, `tests/helpers/*` (except `node-codec.ts`), `tests/e2e/fixtures.ts`, `README.md`, `LICENSE`. `src/app/testing/fake-ai-engine.ts` is A-only: other lanes request changes at a milestone |
| B | `src/features/{measure,dom-snippet,demo,run}/**` except their `ui/`; `sample-site/`, `scripts/capture-sample.mjs`, `tests/helpers/node-codec.ts` |
| C | `src/features/{projects,contract,settings,deep-analysis,export}/**`; every `src/features/*/ui/**`; `src/app/styles/`, `src/app/copy.ts` |

- Tests live in `tests/<layer>/<module>/`. The owner of the code under test owns its tests (so `tests/component/run/` is lane C). E2E specs: owner named in phase 14.
- `tests/fixtures/ai/<task>-*.json` belongs to the owner of the module that calls that task (`extract-contract`, `infer-responsive`: C; `judge`: B; `deep-analysis`: C).
- **Shared files** (`package.json`, lockfile, `tsconfig*.json`, `vite.config.ts`, `tests/architecture/modules.json`, `.dependency-cruiser.cjs`, `biome.json`, CI workflow) are written in Step 0. A later change is made by lane A alone, at a milestone, announced to all lanes.
- Modules with `ui/` export it through `ui/index.ts`, pre-wired in Step 0, so lane C never edits a B-owned `index.ts` (SPEC-ARCH-11).
- Every `index.ts` declares its full public API from Step 0 (3.2). Lanes replace stub bodies, never signatures; a signature change follows the kernel change rule.
- UI component names in `ui/index.ts` are frozen at G0; their `Props` interfaces are lane C's and may gain optional fields without the kernel change rule.

## Kernel change rule (after G0)

`src/shared/kernel` is frozen at G0 (SPEC-ARCH-11). A change needs: the SPEC §4.1 edit, one commit touching only kernel, SPEC, its tests and `remoteconfig.template.json` when `DEFAULT_RUNTIME_VALUES` changes, merged to `main` by its requester, then every open worktree rebases. Prefer adapting inside your module.

## Merge rule

Rebase on `main`, run `npm run check:fast`, merge in the milestone order of [14](14-INTEGRATION.md). `main` stays green; a red merge is reverted, not patched forward.

## VERIFY items

A **VERIFY** fact (SPEC §10.2) is resolved by its spike in [04](04-SPIKES.md): check the live doc or run the call, then (1) write `// SPEC-XX-NN verified YYYY-MM-DD: <answer>` at the code site, (2) amend the SPEC leaf if the answer differs, (3) continue. Never block on an item with a documented fallback; apply the fallback and note it in the task.
