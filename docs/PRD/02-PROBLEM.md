# 2. Problem

**[◀ 1. Product Identity](01-PRODUCT-IDENTITY.md)** · [PRD index](../PRD.md) · **[3. Scope Fence ▶](03-SCOPE-FENCE.md)**

Solo developers and small agencies increasingly implement designs by asking a coding agent to build them. The loop is: receive a design → the agent implements it → the developer eyeballs the result → asks the agent to "fix what looks wrong" → repeat. The result often *looks plausible* yet silently misses requirements: a missing element, a narrower CTA, a flattened type hierarchy, a mobile layout that overflows.

Taking screenshots is easy. What is missing is a **reliable, structured way to decide whether the implementation satisfies the design**, and a precise way to tell the agent what to fix.

## Gaps this product addresses

| Gap | Today | ConformUI answer |
|---|---|---|
| Implicit intent | The design is a picture; "correct" lives in the reviewer's head. | Design Acceptance Contract of individually checkable Requirements (F-03). |
| Vague feedback | "Layout looks off" gives an agent nothing to act on. | Findings with measured deltas and a verification condition (F-05). |
| Pixel-diff noise | Pixel diffs flag anti-aliasing and under-weight small but serious defects (a missing button). | Semantic + geometric checks; severity by impact, not pixel count (P-03). |
| Models guessing numbers | Model-only reviewers invent sizes and positions. | Deterministic engine owns every number (P-02). |
| Responsive blind spot | Only a desktop mock exists; mobile goes unchecked. | Multi-viewport Runs; Inferred expectations labelled separately (F-08). |
| No closure | Nobody confirms the fix landed. | Re-verify shows Resolved / Remaining (F-07). |
| Client design privacy | Unreleased designs get pasted into cloud tools. | On-device first pass; cloud only on explicit action (§7). |

Audience size and willingness to pay are not validated (R-08); no market figures are claimed.
