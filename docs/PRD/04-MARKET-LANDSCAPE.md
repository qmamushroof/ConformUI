# 4. Market Landscape

**[◀ 3. Scope Fence](03-SCOPE-FENCE.md)** · [PRD index](../PRD.md) · **[5. Personas ▶](05-PERSONAS.md)**

"Compare a design with a screenshot of the site" is **not novel**. Overlapping products:

| Tool | What it does | Relevance |
|---|---|---|
| [Applitools Eyes](https://applitools.com/docs/eyes/sdks/storybook/integrations/figma-compare) | Figma-to-implementation comparison, Visual AI, [design baselines](https://applitools.com/solutions/design-team/), layout and typography discrepancy detection; MCP integration for coding agents. | Closest and strongest competitor. |
| [Percy](https://www.browserstack.com/docs/percy/visual-testing-workflows/figma/overview) | Figma design comparison, screenshot matching, stakeholder review. | Basic design comparison is covered. |
| [Chromatic](https://www.chromatic.com/features/visual-test) | Visual regression, responsive, component, interaction and accessibility testing. | Strong developer-workflow incumbent. |
| [UI Inspect](https://docs.ui-inspect.dev/docs/guides/design-to-code) | Compares design images with live implementations; pixel differences; suggests CSS fixes. | AI-assisted design-to-code correction exists. |
| Coding agent + Playwright (DIY) | Agents already screenshot, assert and investigate UI. | "Another way for an agent to look at screenshots" is weak on its own. |

## Not our proposition

Two screenshots → AI comparison; Figma frame vs screenshot; AI explaining pixel diffs; generated CSS fixes. These exist or are easy to replicate.

## Honest differentiation

| Claim | Basis |
|---|---|
| Design intent becomes an explicit, editable, exportable **contract** of checkable Requirements, not a baseline image. | F-03, F-09 |
| **Measured, not guessed:** the deterministic engine owns numbers; AI extracts and judges. | P-02, §7 |
| Explicit vs **Inferred** responsive expectations kept separate. | P-04, F-08 |
| Closes the loop with any coding agent: **Fix prompt → Re-verify**. | F-07, F-09 |
| **Private first pass on-device**, no account, no backend, free to try, works offline. | §7, D-04, D-08 |

**Not claimed:** a technological moat or better detection than vendor-scale visual AI. The edge is a focused, agent-independent acceptance workflow for AI-assisted builders.
