# 3. Scope Fence

**[◀ 2. Problem](02-PROBLEM.md)** · [PRD index](../PRD.md) · **[4. Market Landscape ▶](04-MARKET-LANDSCAPE.md)**

## ConformUI is

- A checker for **one page at a time**, at Desktop and Mobile viewports (Tablet P1).
- Driven by **user-supplied screenshots** plus an optional **DOM snapshot** the user captures from their own page (§9).
- Contract-first: requirements → checks → evidence → fix prompt → re-verify.
- A hybrid on-device + cloud analyzer (Firebase AI Logic) with a visible Engine label, backed by a deterministic measurement engine.
- An installable, offline-capable PWA with local-only storage; no backend, no account.
- Open source (Apache-2.0).

## ConformUI is not

| Not | Why |
|---|---|
| A visual-regression platform (baselines across builds, CI) | Crowded (§4); not the problem solved. |
| A Figma plugin or Figma API client | No Figma OAuth/API (D-12). Users export frames as images. |
| A live-URL capture tool or crawler | No URL capture, remote browser, crawling or multi-page testing (D-05, D-12). |
| A CI or GitHub integration | Excluded from release 1 (D-12). |
| An autonomous code fixer | It produces a Fix prompt; it never edits code (D-12). |
| A chatbot | Structured outputs only; no open chat input (P-08). |
| A collaboration tool with accounts | No accounts, sharing or cloud storage (D-07). |
| A pixel-perfect oracle | Findings carry confidence; Inferred Requirements are advisory (P-04). |
