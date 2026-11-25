# 5. Personas

**[◀ 4. Market Landscape](04-MARKET-LANDSCAPE.md)** · [PRD index](../PRD.md) · **[6. Product Principles ▶](06-PRODUCT-PRINCIPLES.md)**

| Persona | Situation | Needs | Design consequence |
|---|---|---|---|
| **Solo developer with a coding agent** (primary) | Implements a client's or own design through an AI coding agent, working in desktop Chrome. | Know objectively what is wrong; tell the agent precisely; confirm the fix. | Contract, measured Findings, Fix prompt, Re-verify; desktop-first layout; DOM snippet. |
| **Small agency lead** | Reviews several AI-built pages before client hand-off; designs are often under NDA. | Fast acceptance pass; a report to hand over; designs stay private. | On-device first pass, Markdown/JSON export, local-only storage. |
| **Mobile reviewer** | Checks a page on an Android phone and shares a screenshot into the app. | Capture from the phone, see Findings, copy the Fix prompt. | Android share target, responsive UI, Cloud engine labelled honestly. |

Not a persona: QA teams needing CI baselines, multi-page suites or Figma sync (§3).
