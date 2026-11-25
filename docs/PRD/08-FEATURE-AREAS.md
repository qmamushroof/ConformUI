# 8. Feature Areas

**[◀ 7. Hybrid Inference](07-HYBRID-INFERENCE.md)** · [PRD index](../PRD.md) · **[9. Inputs & DOM Snippet ▶](09-INPUTS-DOM-SNIPPET.md)**

Priorities: **P0** ships in release 1 (cut line), **P1** ships if P0 is done, **Later** is out of release 1 (§11). Sub-requirements without a marker are P0; "(P1)" marks deferred ones.

| ID | Area | What the user gets | Priority |
|---|---|---|---|
| F-01 | **Projects** | Create, open, delete Projects; list with last Run status. Local only. | P0 (rename P1) |
| F-02 | **Inputs** | Design references and implementation captures per viewport; optional DOM snapshot (§9). | P0 (share target P1) |
| F-03 | **Design Acceptance Contract** | Requirements extracted from the design, reviewed and edited by the user. | P0 (region drawing, versioning P1) |
| F-04 | **Verification Run** | Contract checked against captures; per-Requirement status; engine trace. | P0 |
| F-05 | **Findings and evidence** | Evidence-backed Findings with severity, confidence, fix, condition. | P0 (filters, dismiss P1) |
| F-06 | **Deep Analysis** | Cloud pass on a Run on explicit action. | P0 |
| F-07 | **Re-verify** | New captures against the same Contract; Resolved / Remaining / New / Regressed. | P0 (Run compare P1) |
| F-08 | **Multi-viewport** | Desktop and Mobile in one Run; Inferred expectations labelled. | P0 (Tablet, custom width P1) |
| F-09 | **Exports** | Fix prompt for a coding agent; Contract + report as Markdown and JSON. | P0 (scoping, import P1) |
| F-10 | **Demo sample** | One-click sample Project (§10). | P0 |
| F-11 | **Engine status and settings** | Model readiness, enable guide, mode, cloud consent, privacy counter, clear data. | P0 |
| F-12 | **Install, offline, onboarding** | Installable PWA, offline shell, one-screen first run. | P0 (share target P1) |
| F-13 | **DOM snippet** | Copy-paste script that exports real DOM measurements from the user's own page (§9). | P0 (bookmarklet P1) |

## Vocabulary (fixed)

| Field | Values |
|---|---|
| Requirement category | Presence · Content (text) · Position/alignment · Size · Spacing · Typography hierarchy · Colour · Responsive (overflow, overlap, stacking) |
| Requirement label | Explicit · Inferred |
| Check type | Measured · Visual · Judged |
| Requirement status in a Run | Pass · Fail · Needs review · Not checked (with reason) |
| Severity | Critical (element missing or unusable) · Major (clearly visible deviation) · Minor (small deviation or Inferred) |
| Confidence | High · Medium · Low |
| Re-verify change | Resolved · Remaining · New · Regressed · Still passing |

## Acceptance requirements

### F-01 Projects
- F-01.1 Projects persist across reloads and offline; deleting a Project removes all its images and Runs.
- F-01.2 Project list shows name, viewports present, last Run date and Pass/Fail counts.
- F-01.3 (P1) Rename a Project.

### F-03 Contract
- F-03.1 "Extract contract" produces Requirements from the design reference(s); each has an ID, category, label, check type, target region on the design, plain statement, and verification condition.
- F-03.2 Each AI-produced Requirement shows its Engine.
- F-03.3 The user can accept, edit the text of, delete and add Requirements. The reviewed Contract is what Runs verify. (P1) Draw or adjust a Requirement's target region.
- F-03.4 Requirements are checkable statements, e.g. "Navigation contains logo, four links and a primary CTA"; "Hero heading is the largest text on the page"; "Primary CTA width is within tolerance of the design".
- F-03.5 Once a Run exists, the Contract is locked; editing creates a new Contract, and each Run records the Contract it used. (P1) Contract versioning with history within one Project.
- F-03.6 AI-proposed regions are suggestions. The deterministic engine snaps each to detected element bounds on the design image (or, P1, the user adjusts it). Geometric and colour design values come only from snapped or user-set regions and are source-tagged "design image"; user-accepted expected counts or text (e.g. "4 nav links") are source-tagged "contract" (P-02).

### F-04 Verification Run
- F-04.1 Captures are aligned to the design for the same viewport (scale to width); misaligned or mismatched aspect is reported, not silently cropped.
- F-04.2 Measured and Visual checks run deterministically; Judged checks run through the first-pass engine (§7).
- F-04.3 Every Requirement gets a status; Not checked always states why (no capture for viewport, no DOM snapshot, offline, consent declined).
- F-04.4 Run progress is visible per stage; deterministic stages finish in ≤ 3 s on the sample (M-08).
- F-04.5 **Engine trace** per Run: each step listed with its Engine (On-device / Cloud / Measured), duration, and bytes sent off-device (0 for On-device and Measured).

### F-05 Findings
- F-05.1 Each Finding shows: Requirement, side-by-side design and implementation crops (Presence: implementation crop of the expected region), diff overlay toggle, measured deltas with source tags, severity, confidence, Engine, suggested fix, verification condition.
- F-05.2 Statements are specific and measured, e.g. "Primary CTA is 132 px wide vs 220 px in the design (−40%), measured from DOM snapshot."
- F-05.3 Findings are sorted by severity. (P1) Filter by viewport, severity, label and status.
- F-05.4 Clicking a Finding highlights its region on both images.
- F-05.5 (P1) Dismiss a Finding as "accepted deviation" with an optional note; it is excluded from the Fix prompt and kept in the report.

### F-06 Deep Analysis
- F-06.1 Button on a Run; a confirm sheet lists exactly what is sent (images, Contract, measurements) before the request (H-05).
- F-06.2 Output updates Needs-review and low-confidence Findings with refined explanation, confidence and fix; each change is labelled Cloud.
- F-06.3 Disabled offline, with a plain reason.

### F-07 Re-verify
- F-07.1 "Re-verify" accepts new implementation captures (and optional new DOM snapshots) and runs the same Contract.
- F-07.2 Results show per Requirement: Resolved, Remaining, New, Regressed, Still passing; a summary line ("6 resolved, 1 remaining").
- F-07.3 Run history per Project lists Runs with counts.
- F-07.4 (P1) Compare any two Runs.

### F-08 Multi-viewport
- F-08.1 Presets Desktop (1440) and Mobile (390). (P1) Tablet (768) and custom width.
- F-08.2 A Run covers every viewport that has an implementation capture.
- F-08.3 Where a viewport has no design reference, its Requirements are Inferred and follow P-04. They are exactly: one "layout fits" Requirement (no horizontal overflow, no overlapping elements, no clipped text); one "primary action visible" Requirement per primary Requirement of the nearest design; and optional AI proposals, labelled Inferred. Other design Requirements are not copied. Inferred IDs are viewport-prefixed (e.g. `I-D-01`, `I-M-01`).

### F-09 Exports
- F-09.1 **Fix prompt**: one click copies paste-ready text for a coding agent containing page context, each Fail Finding plus each Needs-review Finding marked "verify first" (requirement, expected vs observed with measured values, viewport, selector when known, suggested fix, verification condition), and an instruction to leave passing Requirements unchanged. Text only.
- F-09.2 (P1) Scope the Fix prompt: selected Findings or one viewport.
- F-09.3 **Contract export** and **Run report export** as Markdown and JSON (download and copy). JSON is schema-versioned.
- F-09.4 Exports contain the Engine and source tag of every item.
- F-09.5 (P1) Import a Contract JSON into a new Project.

### F-11 Engine status and settings
- F-11.1 Engine panel: on-device Available / Downloading (progress) / Unavailable (reason); detects a missing Chrome flag or Prompt API and shows copy-paste enable steps (e.g. `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`); Cloud reachable or not; current mode.
- F-11.2 Download the on-device model from a button.
- F-11.3 Mode switch (H-04: Auto, Cloud only; P1 On-device only); per-Project cloud consent can be revoked.
- F-11.4 Clear all local data, with confirmation.
- F-11.5 **Privacy counter**: a persistent indicator reads "Nothing has left this device" until the first cloud call, then shows the count and bytes of cloud requests for the current Project.

### F-12 Install, offline, onboarding
- F-12.1 Installable on desktop Chrome and Android; app shell and sample open offline.
- F-12.2 First run: one screen explaining the Contract → Run → Fix → Re-verify loop, the three engines, and privacy; "Try the sample" as primary action.
- F-12.3 (P1) Android share target: sharing an image into the app opens "Add capture" with the image prefilled.

## Core flow

Create Project → add design reference(s) → **Extract contract** (on-device) → review Contract → add implementation captures (+ DOM snapshots) → **Run** → review Findings and engine trace → optional **Deep Analysis** (cloud) → **Copy fix prompt** → agent fixes code → add new captures → **Re-verify** → export report.

## Empty and error states

| State | Behaviour |
|---|---|
| No Projects | Explain the loop; buttons "Try the sample" and "New project". |
| No design reference | Extract disabled; hint on accepted formats and how to export a frame as an image. |
| No implementation capture for a viewport | That viewport's Requirements show Not checked. |
| Unsupported or oversized image | Say which formats and limits apply; nothing silently cut. |
| Invalid DOM snapshot JSON | Show what is wrong; Run proceeds image-only, with Measured DOM checks Not checked. |
| On-device unavailable / flag missing / downloading | Explain with enable steps; offer cloud with consent (H-05) or manual Requirements. |
| Offline | Measured/Visual checks run; Judged checks and Deep Analysis show Not checked / disabled with reason. |
| Quota or rate limit | Explain; keep all completed results; retry later. |
| Model output invalid twice | Item marked Needs review with reason; Run continues. |
