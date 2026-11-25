# 1. Product Identity

**[◀ 0. Document Map](00-DOCUMENT-MAP.md)** · [PRD index](../PRD.md) · **[2. Problem ▶](02-PROBLEM.md)**

| Field | Value |
|---|---|
| Name | **ConformUI** |
| One-line pitch | Design acceptance testing for AI-built websites: turn a design into a checkable contract, verify the implementation against it with measured evidence, and hand the failures back to your coding agent. |
| Question it answers | "Does this implementation satisfy the design it was meant to implement?" — not "did this page change?" (visual regression). |
| Form | Installable web app (PWA), no backend, no account. Open source, Apache-2.0, repo at `<REPO_URL>` (PRD-D-30), hosted demo at `<HOSTED_URL>`. |
| Category | Design-conformance QA tool. **Not a chatbot** and not a general visual-testing platform. |
| Hybrid idea | Private first pass on the device (the design stays on the machine unless you choose cloud); cloud only for deeper analysis on request or when the device cannot; every number comes from a deterministic engine, never from a model. The engine that answered is always shown. |

## Core terms

| Term | Meaning |
|---|---|
| **Project** | One page being checked: its design references, implementation captures, Contract and Runs. Stored locally. |
| **Design reference** | Image of the intended design for one viewport (PNG, JPEG or WebP). |
| **Implementation capture** | Screenshot of the built page for one viewport, plus an optional DOM snapshot. |
| **DOM snapshot** | JSON produced by the **DOM snippet** the user runs on their own page (DevTools console or bookmarklet): element boxes, text, key computed styles, overflow (§9). |
| **Viewport** | Desktop or Mobile (P0 presets; Tablet and custom width P1). Each capture belongs to one viewport. |
| **Design Acceptance Contract** (Contract) | The list of Requirements extracted from the design and reviewed by the user. The unit that is verified and exported. |
| **Requirement** | One checkable statement with a target region, a check type and a verification condition. Labelled **Explicit** (visible in a design reference) or **Inferred** (a responsive expectation no reference shows). |
| **Check type** | **Measured** (numbers from the DOM snapshot or image geometry), **Visual** (deterministic image/region comparison), **Judged** (model judgement, labelled with Engine and confidence). |
| **Run** | One verification of the Contract against one set of implementation captures. |
| **Finding** | A failed or uncertain Requirement in a Run, with Evidence, severity, confidence, suggested fix and verification condition. |
| **Evidence** | Design vs implementation crops, diff overlay, measured deltas, and the source of every number. |
| **Engine** | Which path produced an output: **On-device** (Gemini Nano), **Cloud** (Gemini) — from the SDK's reported inference source — or **Measured** (deterministic engine, no model). |
| **First pass** | Contract extraction and discrepancy candidates; on-device when available. |
| **Deep Analysis** | Cloud analysis of a Run on explicit user action (§7). |
| **Re-verify** | A new Run against the same Contract; each Requirement shows Resolved, Remaining, New or Regressed. |
| **Fix prompt** | Paste-ready text for a coding agent, built from the failing Findings. |
