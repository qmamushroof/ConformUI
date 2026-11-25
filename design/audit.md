# ConformUI prototype — verification audit

Two passes run, 2026-11-25. The final shoot (375 / 768 / 1280 plus 1280 dark) is in `shots/verify/`.

## Pass 1 (before fixes)
| Check | Result |
|---|---|
| Contrast (`contrast.mjs tokens.json`) | 64 pairs checked, 0 failing (AA) |
| Lint | 15 errors. One real: placeholder name "Acme" in settings.html. The other 14 are false positives: radios wrapped in `<label>`, hrefs built in JS strings, and `href="#sym"` inside SVG `<use>`. Warnings are raw hex inside the sample-artwork SVG overlays and the `theme-color` metas, both intentional. |
| Render | 0 blockers. The only major is 20×20 radios, but their whole label is the click target, so they pass WCAG 2.5.8. |
| Critic | Hierarchy 4 · Layout/rhythm 3 · Typography 4 · Colour 4 · Consistency 2.5 · Usability 3.5 · Originality 3.5 · Brief fit 4 · Calm 3.5 |
| a11y | 0 blockers, 5 majors, 6 minors |

The user's original complaints were "messy", "screams AI", too many colours and em dashes. The critic confirmed these were largely fixed in pass 1: one font family, mono only for code and IDs, 4 hues, no chips, one primary button per view, and no em dashes.

## Fixed in pass 2
- **Frame and spacing**
  - Every route now uses one left-aligned 24 px gutter; the Project h1 no longer sits apart from its breadcrumbs.
  - Inline width hacks were removed from compare, contract and run.
  - One page-head pattern on every route: title on the left, actions on the right with the primary last.
  - The `.meta` separator "·" now trails its item, so it never starts a wrapped line.
- **Contract screen**
  - The list no longer repeats "Measured · Sample (verified) · Accepted" on all 19 rows; provenance is stated once in the list head.
  - On the canvas, dimension labels sit outside regions, container regions are hidden unless selected, and nothing overlaps the text.
- **Phones:** under 640 px the stepper shows "Step 4 of 6: Run · Fix, next".
- **Smaller visual fixes**
  - Ghost buttons line up optically with the content edge.
  - The engine label in a row matches the size of the rest of that row's meta line.
  - The label/value block lines up on the baseline.
  - Thumbnails lost their nested border.
  - Settings "Clear all data" is now an outlined button with red text; the filled red button is kept only inside the confirm sheet.
  - Numbered steps in Onboarding and Snippet are plain numerals instead of extra circles.
- **Accessibility**
  - Focus is restored after Accept, Edit, Delete and Cancel on the contract detail.
  - The run announcement now matches the state (running, complete, re-verify).
  - `aria-live` was removed from the detail panel; the selected title is announced instead.
  - The toast live region is created up front, so the first toast is announced.
  - The resolved image's alt text was updated.
  - Scrolling respects reduced motion, and Enter moves focus to the detail.
  - The viewport filter is now an `aria-pressed` group instead of a fake tablist.
  - Stale `aria-describedby` and `aria-activedescendant` were removed.
  - The clear-data button uses `aria-disabled` with a visible reason.
  - Segmented buttons are 44 px tall.

Final state: 0 render blockers and no console errors. Contrast and lint are clean apart from the false positives above.

## Deferred / not verified
- No full critic re-score after pass 2. The fixes map one-to-one onto the critic's findings, and both reviewed screens (contract, run) were checked visually after the fixes.
- 320 px and 200 % zoom were not checked in a real browser beyond the 375 px shots, and neither was the Tab order inside open sheets. Both should be checked by hand before submission (SPEC §5.5).
- When the devbar switches states that change the project header (contract no-design, onboarding can-download), the header only resets after a reload. This is a prototype-only limitation.

## Screenshot index
`shots/verify/<screen>-{375,768,1280}.png`, `<screen>-1280-dark.png` for: 404, compare, contract, index, onboarding, project, projects, run, settings, snippet. The direction exploration is in `shots/directions/`.
