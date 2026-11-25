# SPEC — ConformUI

*How* ConformUI is built. *What* and *why*: `docs/PRD.md`. Build order: `docs/ROADMAP.md`.

| § | Read this when | File |
|---|---|---|
| 1 | What the SPEC owns, conflict order, ID format, P0/P1/Later tiers | [01-DOCUMENT-IDENTITY.md](SPEC/01-DOCUMENT-IDENTITY.md) |
| 2 | Toolchain, verified versions, every dependency and why | [02-STACK.md](SPEC/02-STACK.md) |
| 3 | Repo tree, modules, allowed dependencies, enforcement, extension points | [03-ARCHITECTURE.md](SPEC/03-ARCHITECTURE.md) |
| 4.1 | **kernel** — domain types, ports, zod schemas, consent, mode resolution, errors, limits | [04-01-KERNEL.md](SPEC/04-01-KERNEL.md) |
| 4.2 | **firebase** — app init, App Check, Remote Config keys and defaults | [04-02-FIREBASE.md](SPEC/04-02-FIREBASE.md) |
| 4.3 | **ai-engine** — Firebase AI Logic hybrid adapter, modes, `inferenceSource`, readiness, structured output | [04-03-AI-ENGINE.md](SPEC/04-03-AI-ENGINE.md) |
| 4.4 | **imaging + measure** — image normalisation, alignment, region snapping, region diff, geometry, DOM measurements | [04-04-MEASURE.md](SPEC/04-04-MEASURE.md) |
| 4.5 | **dom-snippet** — snippet source, DOM snapshot schema v1, privacy guarantees | [04-05-DOM-SNIPPET.md](SPEC/04-05-DOM-SNIPPET.md) |
| 4.6 | **projects + storage** — Projects, inputs per viewport, IndexedDB schema | [04-06-PROJECTS-STORAGE.md](SPEC/04-06-PROJECTS-STORAGE.md) |
| 4.7 | **contract** — extraction, snapping, Inferred requirements, review, lock | [04-07-CONTRACT.md](SPEC/04-07-CONTRACT.md) |
| 4.8 | **run** — Verification Run, checks, severity, Findings, engine trace, Re-verify | [04-08-RUN.md](SPEC/04-08-RUN.md) |
| 4.9 | **deep-analysis** — confirm sheet, cloud call, merge, daily cap | [04-09-DEEP-ANALYSIS.md](SPEC/04-09-DEEP-ANALYSIS.md) |
| 4.10 | **export** — Fix prompt, Contract/Report Markdown and JSON | [04-10-EXPORT.md](SPEC/04-10-EXPORT.md) |
| 4.11 | **demo** — sample assets, sample site, committed Contract, pre-computed fallback | [04-11-DEMO.md](SPEC/04-11-DEMO.md) |
| 4.12 | **settings** — engine panel, mode, consent revoke, privacy counter, clear data, onboarding | [04-12-SETTINGS.md](SPEC/04-12-SETTINGS.md) |
| 4.13 | **app shell + PWA** — composition root, routes, manifest, service worker | [04-13-APP-PWA.md](SPEC/04-13-APP-PWA.md) |
| 5 | Screens, components, design tokens, states, accessibility | [05-UI.md](SPEC/05-UI.md) |
| 6 | Security, privacy, performance budgets | [06-SECURITY-PRIVACY-PERFORMANCE.md](SPEC/06-SECURITY-PRIVACY-PERFORMANCE.md) |
| 7 | Testing strategy, fake AI engine, sample-based acceptance, ID citation | [07-TESTING-STRATEGY.md](SPEC/07-TESTING-STRATEGY.md) |
| 8 | Firebase Hosting, env, CI, license, README | [08-DEPLOY.md](SPEC/08-DEPLOY.md) |
| 9 | SPEC decisions (`S#`) | [09-DECISIONS.md](SPEC/09-DECISIONS.md) |
| 10 | PRD → SPEC traceability (every P0 PRD ID) and open VERIFY items | [10-TRACEABILITY.md](SPEC/10-TRACEABILITY.md) |
