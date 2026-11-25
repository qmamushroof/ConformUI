# ConformUI — developer handoff

For the agents building ROADMAP phase 13 (UI). Read alongside `DESIGN.md`, which holds the principles, token tables, component specs and do/don't list. The prototype is the visual reference, not code to copy: `prototype/` is vanilla HTML/JS, and the app is React 19 + Tailwind v4.

## Tokens
- The source is `design/tokens.json`. Regenerate with `node <do-design>/scripts/tokens.mjs design/tokens.json design --tailwind`.
- `tokens.css` holds the CSS variables, light/dark through `prefers-color-scheme` plus `[data-theme]` (the `[data-theme]` blocks are inert in release 1, S10: no manual toggle). Copy it to `src/app/styles/tokens.css`.
- `tokens.tailwind.css` holds the `@theme` mapping; import it after `@import "tailwindcss"`.
- SPEC-UI-03's contrast test should assert the pairs in `tokens.json` (`$pairs` + roles); 64 pairs pass AA today.
- The no-hex grep test still applies. The sample-artwork SVGs are exempt because they are images.

## SPEC changes this design needs (owner decision, then update docs)
| SPEC | Current | Design | Why |
|---|---|---|---|
| §5.2 tokens | `major`, `minor`, `review` hues plus `*-bg` tints | Removed. Severity is shown in ink by shape and word; Needs review is ink with a dashed icon. Added `surface-raised`, `surface-sunken`, `border`, `text-subtle`, `accent-subtle`. | The owner asked for fewer colour variations; four hues remain. |
| §5.2 typography | system UI stack | IBM Plex Sans 400/500/600 + Plex Mono 400/500 (OFL) | The owner felt system fonts "scream AI". Mono is used only for code, IDs, selectors and dimension labels. |
| §5.2 radius | 10 px | 3 / 4 / 6 px | Flatter shapes, at the owner's request. |
| §2 stack | no font packages | add `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` (Latin woff2, about 70 KB), precached by the service worker | Offline PWA (SPEC-PWA-03) |
| §5.3 | severity octagon/triangle/circle in colour | the same shapes, in ink | as above |
| copy | SPEC-SET-01 strings contain em dashes | replace each with a colon or full stop (e.g. "On-device model ready. First pass stays on this device.") | The owner rule: no em dashes in UI copy |

## Screens
Each prototype file is one route. The states are listed in `prototype/index.html`, and the devbar's `?state=` switcher shows each one.
| Route | File | Layout | Notes |
|---|---|---|---|
| `/` | projects.html | `.page`, card grid (auto-fill 300 px) | Delete asks you to type the project name; uses error code `STORAGE_UNAVAILABLE` (see Open questions) |
| `/welcome` | onboarding.html | `.page` | can-download state |
| `/p/:id` | project.html | `.page`; 2 viewport columns, stacked under 900 px | Primary action changes by state: Extract, Run or Re-verify. Includes share target (P1). |
| `/p/:id/contract` | contract.html | split: 380 px list + canvas/detail; stacked under 1100 px | On the canvas, regions are outlined 4 design-px outside their true bounds; container regions show only when selected |
| `/p/:id/run/:runId` | run.html | split (reference screen) | `?f=` selects a Finding; the evidence pair stacks under 900 px |
| `/p/:id/compare` (P1) | compare.html | `.page`, table scrolls inside its own box | |
| `/snippet` | snippet.html | `.page` | schema `conformui.dom-snapshot` (SPEC-SNIP-01) |
| `/settings` | settings.html | `.page` + sticky section nav at 1100 px and wider | engine statuses per SPEC-SET-01 |
| `*` / boundary | 404.html | `.page` | `ROUTE_ERROR` |

Breakpoints: 640 (sheets become bottom sheets; the stepper collapses to "Step n of 6"), 720 (header nav goes into a menu), 900 (evidence and two-column blocks stack), 1100 (split views stack).

## Signature: dimension lines (ComparisonView, Contract canvas)
- SVG overlays use the same coordinate system as the design image (design px). Design region: solid `--accent`, 3 px. Implementation region: dashed ink (`#111827` on the white capture), 3 px, dash 8/6.
- A dimension line is a 2 px line with 16 px end ticks. Its label is Plex Mono 500 at 17 design-px, with a white knockout rect behind it, placed outside the region.
- The delta bracket on the implementation is a red dashed segment from the actual end to the expected end, labelled with the signed difference ("−88").
- Diff overlay: `--diff` at 60 % opacity, toggled by an `aria-pressed` button. The note below the images states the percentage in text.
- Helpers are in run.html (`dimH`, `dimV`, `outline`). Port them as `<DimensionLine>`, `<RegionOutline>` and `<DiffMask>` inside `ComparisonView`.

## Interactions and motion
| Trigger | Change | Token | Reduced motion |
|---|---|---|---|
| Hover on button or row | background colour | `--duration-fast` `--ease-standard` | none |
| Disclosure | chevron rotates 90° | `--duration-base` | instant |
| Progress | bar width | `--duration-slow` | instant |
| Toast | fades up 6 px in, removed after 2.6 s | `--duration-slow` `--ease-enter` | no animation |
| Finding select (Up/Down, click) | detail re-renders, `?f=` updates, title announced | none | none |
| Enter on a narrow screen | scrolls to the detail and focuses `#d-title` | smooth scroll | `auto` |
| Sheets | `<dialog>.showModal()`; Esc closes; focus returns to the trigger | none | none |

## Assets
- **Fonts:** IBM Plex Sans and Plex Mono, SIL OFL 1.1.
- **Icons:** about 40 inline SVG line icons, 24 grid, 1.6 stroke, square caps, matching the logo's geometry. They are in `prototype/assets/sprite.js`; port them to `src/app/icons.tsx`.
- **Logo:** `docs/brand/logo.svg`, rendered with `currentColor` in the `--accent` colour.
- **Sample artwork:** the sprite symbols `sample-*` are placeholders. Replace them with real captures from the committed sample pages (PRD F-10.4) at build time.

## Open questions
1. Approve the SPEC deltas above (tokens, font, radius, copy), or keep SPEC as written and accept the louder palette.
2. `STORAGE_UNAVAILABLE`: should it be added to kernel `ErrorCode`? The Projects error state needs a code.
3. Contract extraction bands: SPEC computes 2 bands for the 1440 design; the brief assumed 3 (header, hero, sections). The prototype follows SPEC.
4. The Deep Analysis model name in the confirm sheet (`gemini-2.5-pro`) is a placeholder until the cloud-models VERIFY spike.
