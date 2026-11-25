# 6. Product Principles

**[◀ 5. Personas](05-PERSONAS.md)** · [PRD index](../PRD.md) · **[7. Hybrid Inference ▶](07-HYBRID-INFERENCE.md)**

Non-negotiable. A feature violating one is changed, not the principle.

| ID | Principle | Meaning | Observable test |
|---|---|---|---|
| P-01 | **Contract first** | Every Finding traces to a Requirement in the Contract; there are no unanchored Findings. (P1: AI-noticed differences not in the Contract appear as *Suggested requirements* the user can accept.) | No Finding without a Requirement ID. |
| P-02 | **Measured, not guessed** | Every displayed value carries exactly one source: **engine** (measured from DOM snapshot or implementation image), **design image** (geometric or colour design value derived from a snapped/user-set region), or **contract** (a user-accepted expected count or text). Only geometric and colour design values must come from regions. Models judge and extract; they never produce a displayed number. Finding text is a deterministic template. | Every value in a Finding or export has one of the three source tags; model output containing a number not supplied by the engine is not shown as a measurement. |
| P-03 | **Severity by impact, not pixels** | A missing CTA outranks a 1 px font-rendering difference. Rendering noise (anti-aliasing, sub-pixel text) is not a Finding. | Demo sample: no Finding raised for font anti-aliasing alone. |
| P-04 | **Explicit vs Inferred** | Requirements a design reference shows are *Explicit*. Responsive expectations with no matching reference are *Inferred*, visibly labelled, capped at Minor severity, and worded as advisory, never as a design violation. | Every Requirement and Finding carries the label; no Inferred Finding is Critical or Major. |
| P-05 | **On-device first, cloud by consent** | The first pass runs on-device when available. Cloud is used only on explicit user action (Deep Analysis) or, when on-device is unavailable, after the user consents for that Project (§7 H-04, H-05). No automatic cloud fallback before consent. | No cloud request occurs before a user action or Project consent. |
| P-06 | **Show the engine** | Every AI output shows On-device or Cloud from the SDK's reported inference source; deterministic results show Measured. | Engine label on 100% of Requirements, Findings and Runs. |
| P-07 | **Evidence or silence** | Every Finding has design and implementation crops (for Presence Findings, the implementation crop of the expected region), a specific statement, and a reproducible verification condition. No generic statements ("layout looks inconsistent"). | Each Finding renders crops + condition; empty evidence blocks the Finding (shown as Needs review). |
| P-08 | **Not a chatbot** | Discrete, structured analyses with structured results; no open chat input. | No free-text chat box in the UI. |
| P-09 | **Graceful degradation** | No on-device model, offline, quota reached or invalid model output never dead-ends; the user gets the best available path and a plain explanation. | Each unavailable state has a defined screen (§8 states). |
| P-10 | **Reproducible** | Same captures + same Contract → identical Measured and Visual results. Judged results may vary and say so. | Re-running a Run without changes yields identical Measured/Visual statuses. |
| P-11 | **Local by default** | Projects, images and Runs stay on the device; no account; no analytics. | No user content stored or sent anywhere except an approved cloud request. |
| P-12 | **Accessible and polished** | WCAG 2.1 AA for the core flow; severity and status never shown by colour alone; keyboard-operable comparison view. | axe-core in Playwright on Projects, Contract, Run and Finding views: zero serious or critical violations. |

## Privacy statement (shown in the app, plain language)

| Topic | Statement |
|---|---|
| Stored | Projects, images, Contracts and Runs, on this device only. Delete one Project or everything. |
| Sent | Nothing, unless you run Deep Analysis or allow cloud for a Project. Then the listed images, Contract and measurements go to Google's Gemini through Firebase. |
| DOM snippet | Runs only on a page you open; it reads that page and copies JSON to your clipboard. It sends nothing anywhere. |
| App Check | Cloud requests carry an attestation token to prevent abuse; it contains no project content. |
| Analytics | None. |
