# UI sweep

Walked every screen in the e2e build (fake engine) at 320, 390, 768, 1024, 1280, 1440, 1920 px, light and dark, plus a 2x device scale factor, with screenshots of each state (onboarding, project, contract, run, finding, run menu, export, Deep Analysis, Re-verify, projects, settings, snippet, 404, offline). Layout, overflow, console errors and 44 px touch targets were audited per state. Existing specs already cover overflow at 21 viewport sizes and axe in both themes; both stay green.

## Fixed

| Defect | Fix | Regression check |
|---|---|---|
| Header Engine and Privacy icon links were 32 px wide on phones | `min-width: var(--layout-target)` on `.status-link` | clickables.spec, touch targets at 320 and 390 |
| Run viewport filter "All N" was 34 px wide on phones | same rule on `.vpfilter button` | same |
| Hand-typed `/project`, `/projects`, `/p`, `/home`, `/contract`, `/run` dead-ended in a 404 | redirect aliases to Projects; `/project/:id` to `/p/:id`; `/p/:id/run` to `/p/:id` | shell.test, clickables.spec |
| 404 always claimed a run or project was deleted | that sentence only for `/p/:id/...` shaped paths; otherwise "There's no page at /x." | shell.test |
| On-device model named only "Gemma 4" | "Gemini Nano 4 (Gemma 4)" in Settings and onboarding; extraction label "On-device · Gemini Nano 4" or "Cloud · Gemini" | copy, settings and e2e tests |

No horizontal scroll and no console errors were found at any width. Skip-link and checkbox-inside-label "targets" are intentional (skip link is off-screen until focused; the label row is the target).

## Clickables walk (tests/e2e/clickables.spec.ts)

Every header, main and dialog-opening control on: welcome, empty and populated projects, settings (incl. About), snippet, 404, sample project, sample contract, run, own project and own contract. Each is clicked (a quarter also via Enter); the check requires a route change, dialog, DOM change, download or file chooser, no console error, a valid external href with `target=_blank` and `rel=noopener`, and a reason on disabled controls. 191 control activations: 104 navigated, 36 changed the page (toasts, toggles), 21 opened dialogs, 21 external or valid links, 4 opened file choosers, 4 disabled with a reason, 1 already-on filter. No dead control found.

| Control | Location | Expected | Result |
|---|---|---|---|
| Logo, Projects, Snippet, Settings | header | route | ok |
| Engine and Privacy links | header | Settings anchors | ok |
| Try the sample, Start a project | welcome | create sample, go to Projects | ok |
| New project, card menu, Rename, Delete | projects | sheet or menu | ok |
| Design and Capture pickers | project | file chooser | ok |
| Run | project | new Run | ok |
| Extract contract, Accept all, Edit, Add | contract | review state, toast | ok |
| Findings, viewport filter, Diff overlay | run | select or filter | ok |
| Export, Deep Analysis, Re-verify, More actions | run | sheet or menu | ok |
| Engine download, Clear all data | settings | sheet or status | ok |
| Disabled controls | various | reason shown | ok |

Listbox rows (findings, requirements) take Enter on the list, not on the row (covered by e12-keyboard.spec).

## Follow-ups

- Per-finding engine chip still reads "On-device" / "Cloud" (kept short for row width); the full model name appears in Settings and the extraction label.
- Real-browser zoom (150%, 200%) checked via narrower viewport and 200% text size only.
- Re-verify sheet copy on own projects still references the sample's fixed captures (see AUDIT-CONTROLS.md).
- The About Source link now opens in a new tab with `rel="noopener noreferrer"` (found by the clickables walk).
- Remaining nice-to-haves: full-name engine chip on every finding row; real-browser zoom check on a physical device.
