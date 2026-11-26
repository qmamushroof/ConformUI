# 10. Demo Sample and Demo Narrative

**[◀ 9. Inputs & DOM Snippet](09-INPUTS-DOM-SNIPPET.md)** · [PRD index](../PRD.md) · **[11. Release Scope ▶](11-RELEASE-SCOPE.md)**

## F-10 Built-in demo sample (P0)

One click ("Try the sample") creates a Project for a fictional, unnamed landing page (nav logo spot: generic "Sample Co." placeholder; original artwork and copy, no third-party IP, D-28). It opens with the verified sample Contract (F-10.5), the flawed captures and their DOM snapshots preloaded; **Run** is the primary action, so Findings are 2 clicks away (M-13).

- **Extract contract** on the sample runs AI extraction (asking cloud consent first when on-device is unavailable, H-05) and shows an AI-vs-verified comparison; on Decline or failure it shows the labelled pre-computed extraction. The AI Contract becomes active only when the user picks "Use AI contract".
- If no live engine can judge the Judged item (defect 7), Run uses its labelled pre-computed result without a consent modal and offers a non-blocking "Allow cloud to judge live".

| ID | Asset | Content |
|---|---|---|
| F-10.1 | **Design** | Desktop design reference (image). No mobile design, so mobile Requirements are Inferred. |
| F-10.2 | **Flawed implementation** ("what the agent built") | Desktop and Mobile captures + DOM snapshots. Looks plausible at a glance. |
| F-10.3 | **Fixed implementation** ("after the agent applied the Fix prompt") | Desktop and Mobile captures + DOM snapshots. |
| F-10.4 | **Sample pages in repo** (P0) | The flawed and fixed HTML pages are committed in the repo, so captures and snapshots are genuine and reproducible. |
| F-10.5 | **Committed sample Contract** (P0) | A pre-authored, region-verified Contract for the sample design; acceptance is measured against it. |
| F-10.6 | **Hosted sample pages** (P1) | The sample pages are served from the hosted app with snippet instructions, so anyone can run the DOM snippet on them. |

### Planted defects in the flawed implementation

| # | Defect | Viewport | Expected detection | Fixed version |
|---|---|---|---|---|
| 1 | Hero illustration missing | Desktop | Presence · Visual · Critical | Resolved |
| 2 | Primary CTA much narrower than design | Desktop | Size · Measured · Major | Resolved |
| 3 | Type hierarchy flattened: subtitle larger than hero heading | Desktop | Typography · Measured · Major | Resolved |
| 4 | Navigation has 3 links instead of 4 | Desktop | Presence/Content · Measured · Major | Resolved |
| 5 | Mobile nav overlaps hero; page scrolls horizontally at mobile width | Mobile | Responsive · Measured · Minor (Inferred) | Resolved |
| 6 | Secondary section spacing tighter than design | Desktop | Spacing · Measured · Minor | **Remaining** (shows an honest partial fix) |
| 7 | CTA colour slightly off-brand / icon swapped | Desktop | Colour · Judged · Needs review (Low confidence) | Resolved |

Acceptance (against the committed sample Contract, F-10.5): the Run finds defects 1–7 with no Critical/Major false positives; Re-verify on the fixed implementation shows 6 Resolved, 1 Remaining (M-01, M-02). Defects 1–6 are measurable; defect 7 is Judged and is what Deep Analysis refines in the demo.

Committed pre-computed AI outputs (extraction, Judged verdicts, Deep Analysis) also ship as a fallback, so the demo works when no AI engine is reachable; Measured and Visual results are always computed live. Pre-computed items are labelled "Sample results (pre-computed)".

## Demo narrative (YouTube, ≤ 3 minutes)

| Time | Beat | What judges see |
|---|---|---|
| 0:00–0:20 | Problem | A coding agent's landing page that looks right next to its design. "Does it actually match? Saying 'fix what looks wrong' doesn't work." |
| 0:20–0:45 | Private contract | Desktop Chrome, network off. **Try the sample** opens with the verified Contract. **Extract contract** runs **On-device** (Engine badge) and shows the AI-vs-verified comparison: nav items, dominant heading, CTA size, hero illustration; mobile ones labelled **Inferred**. Privacy counter: "Nothing has left this device". |
| 0:45–1:20 | Measured verification | Show the DOM snippet in DevTools producing the committed snapshot (5 s). **Run**: Findings with crops and measured deltas: "CTA 132 px vs 220 px (−40%), from DOM snapshot"; missing illustration; heading hierarchy; mobile overflow at 390 px labelled Inferred; CTA colour as Needs review. Engine trace: every step On-device or Measured, 0 bytes sent. |
| 1:20–1:45 | Hybrid escalation | Network on. **Deep Analysis**: confirm sheet lists what is sent; result labelled **Cloud** refines the CTA colour Needs-review Finding to Fail ("Refined by Cloud"). Engine trace adds a Cloud step with bytes sent; privacy counter updates. |
| 1:45–2:10 | Close the loop | **Copy fix prompt**; paste into a coding agent (cut); show the fixed captures. |
| 2:10–2:35 | Re-verify | **Re-verify**: "6 resolved, 1 remaining"; the remaining spacing Finding still has evidence. |
| 2:35–2:50 | Export and platforms | Export report (Markdown). The sample Project in desktop Chrome device emulation (390 px, on-device unavailable): **Extract contract** asks for cloud consent, then runs Cloud; Engine shows **Cloud**. |
| 2:50–3:00 | Close | "Design intent as a contract. Measured, not guessed. Private by default." Repo + hosted demo URL. |

The video is recorded on desktop Chrome with the multimodal flag enabled and the model ready (R-14). Keep a pre-recorded fallback take of each beat in case the on-device model is not ready on demo day.
