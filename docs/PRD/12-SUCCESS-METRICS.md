# 12. Success Metrics

**[◀ 11. Release Scope](11-RELEASE-SCOPE.md)** · [PRD index](../PRD.md) · **[13. Risks & Mitigations ▶](13-RISKS-MITIGATIONS.md)**

## Release metrics

| ID | Metric | Target | Measured by |
|---|---|---|---|
| M-01 | Demo sample detection | Verifying the committed sample Contract finds defects 1–7 at the expected viewport with the expected status (1–6 Fail, 7 Needs review); zero Critical/Major false positives | Automated test (1–6 deterministic); defect 7 Judged, checked in scripted manual run |
| M-02 | Re-verify correctness on sample | 6 Resolved, 1 Remaining, 0 New/Regressed | Automated test (defects 1–6); manual for defect 7 |
| M-03 | No model-made numbers | 100% of displayed numbers carry exactly one source tag (P-02) | Unit/UI test over Findings and exports |
| M-04 | Engine label coverage | 100% of AI outputs show On-device or Cloud from the SDK inference source; deterministic ones show Measured | UI test |
| M-05 | Structured output validity | 100% of model outputs schema-validated before display; invalid ones become Needs review, never raw text | Unit test with malformed fixtures |
| M-06 | No cloud call without user action or Project consent | 100%; no `PREFER_*` mode before consent | Test with network spy |
| M-07 | Offline first pass | On desktop Chrome 139+ with the multimodal flag on, model ready and network off, Extract contract and Run complete on-device | Scripted demo step (conditional on flag) |
| M-08 | Speed | Deterministic stages of a sample Run (2 viewports) ≤ 3 s; on-device Contract extraction under 60 s (VERIFY on demo hardware) | Manual timing; engine trace durations |
| M-09 | Reproducibility | Re-running an unchanged Run gives identical Measured/Visual statuses | Automated test |
| M-10 | Inferred discipline | No Inferred Finding rated above Minor; every Inferred item labelled | Automated test |
| M-11 | Accessibility | axe-core in Playwright on Projects, Contract, Run and Finding views: zero serious/critical violations | Automated test |
| M-12 | Installability | Install works on desktop Chrome (PRD-D-32); app shell and sample open offline | Manual install and offline check; mobile layout in DevTools device emulation |
| M-13 | Time to first value | New visitor reaches sample Findings in 2 clicks (Try the sample → Run), with no consent modal; if no live engine can judge the Judged item, its labelled pre-computed result is used | Manual check |
| M-14 | AI extraction quality | AI extraction on the sample design proposes Requirements covering ≥ 4 of the 6 measurable planted defects (1–6); report which Engine ran | Manual run, result in README |

Metrics are demo-grade, not production accuracy claims (R-02).

## Judging-criteria mapping (equal weight)

| Criterion | How ConformUI answers | Where |
|---|---|---|
| Technological implementation | Meaningful three-engine split: on-device private first pass, cloud Deep Analysis on demand, deterministic engine owning numbers; consent-safe mode mapping; schema-validated single-turn requests; visible inference source; per-Run engine trace (engine, duration, bytes sent) and privacy counter; App Check, Remote Config; boundaries enforced in code | §7, F-04.5, F-11.5, P-02, D-02, D-03 |
| Design | Complete loop (Contract → Run → Fix prompt → Re-verify → Export) with clear evidence UI, one-click sample, installable, accessible | §8, §10 |
| Potential impact | Real, growing workflow: AI coding agents building from designs; turns vague "fix what looks wrong" into precise, verifiable instructions | §2, §5 |
| Quality of idea | Design intent as an executable contract; measured-not-guessed; explicit vs inferred responsive checks; privacy-first hybrid that a user can see | §1, §4 |

Demo narrative: §10.
