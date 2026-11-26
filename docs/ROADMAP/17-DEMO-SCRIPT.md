# 17. Demo Script

**[◀ 16. Release](16-RELEASE.md)** · [Roadmap index](../ROADMAP.md) · **[18. Cut List ▶](18-CUT-LIST.md)**

Video ≤ 3:00, public on YouTube (PRD-D-13). Beats and timings follow PRD §10. Recorded by the Human in 16.6 on the demo machine (2.8); the mobile beat uses desktop Chrome device emulation (PRD-D-32).

## Before recording

- [ ] Hosted URL in desktop Chrome with the model `available`; Settings > Clear all data; onboarding visible; privacy counter reads "Nothing has left this device".
- [ ] `sample-site/flawed/index.html` from the repo open in a second tab at 1440 px with DevTools ready.
- [ ] A coding-agent window with the flawed page source (for the 1:45 beat; shown generically, no product named).
- [ ] Cloud beat: a second Chrome profile without the multimodal flag (on-device unavailable), DevTools device emulation at 390 px, data cleared.
- [ ] Network toggle reachable (DevTools Network > Offline or OS toggle).
- [ ] One fallback take of each beat already recorded while the model was ready (PRD §10), e.g. right after 14.4.

## Script

| Time | Beat | On screen | Voice-over |
|---|---|---|---|
| 0:00–0:20 | Problem | Sample landing page built by an agent, next to its design | "An agent built this page from a design. It looks right. Does it match? 'Fix what looks wrong' gives the agent nothing to act on." |
| 0:20–0:45 | Private contract | Network off. **Try the sample**. **Extract contract** → Engine badge **On-device**; AI-vs-verified panel; mobile items labelled **Inferred**; counter "Nothing has left this device" | "ConformUI turns the design into a contract of checkable requirements, on this device. Mobile expectations are inferred and labelled advisory." |
| 0:45–1:20 | Measured verification | DevTools: run the snippet, "snapshot copied" (5 s). **Run**: CTA "132 px vs 220 px (−40%), from DOM snapshot"; missing illustration; heading hierarchy; mobile overflow (Inferred, Minor); CTA colour Needs review. Engine trace: On-device / Measured, 0 bytes | "Every number comes from a deterministic engine, not a model. The trace shows what ran where: nothing left the device." |
| 1:20–1:45 | Hybrid escalation | Network on. **Deep Analysis**: confirm sheet lists images and bytes → Send. CTA colour Finding "Refined by Cloud"; trace gains a Cloud step; counter updates | "For a harder judgement I choose the cloud. I see exactly what is sent; the result is labelled Cloud." |
| 1:45–2:10 | Close the loop | **Copy fix prompt**; paste into the agent (cut); **Load fixed implementation** | "The fix prompt gives the agent measured, verifiable instructions." |
| 2:10–2:35 | Re-verify | **Re-verify**: "6 resolved, 1 remaining"; open the remaining spacing Finding with evidence | "Re-verify proves what landed. One spacing issue remains, with evidence." |
| 2:35–2:50 | Export and platforms | **Export report** (Markdown). Device emulation (390 px, on-device unavailable): sample → **Extract contract** → consent sheet → Allow → badge **Cloud** | "Reports export as Markdown or JSON. Where on-device is unavailable, the first pass runs in the cloud, after consent, and says so." |
| 2:50–3:00 | Close | Logo, repo and hosted URL | "Design intent as a contract. Measured, not guessed. Private by default." |

## Fallbacks

- On-device not ready on recording day → use the pre-recorded on-device take of beats 0:20–1:20 (PRD §10, PRD-R-14); never fake a badge.
- Cloud call fails → retry once; else use the pre-recorded take of 1:20–1:45.
- Defect 7 (sample `R-07`) verdict differs live → use the pre-recorded take of 0:45–1:45 and 2:10–2:35.
- Over 3:00 → shorten 1:45–2:10 first (cut the agent paste), then 2:35–2:50 (drop the export).
