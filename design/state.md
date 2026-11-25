# do-design state
phase: done
depth:
mode: full
out: design/
updated: 2026-11-25

## Project
brief: ConformUI — installable PWA for design acceptance testing of AI-built sites: design → Contract → Run (measured Findings) → Fix prompt → Re-verify. Desktop-first, reflows to 320px. Not a chatbot.
stack: none scaffolded; SPEC plans React 19 + Vite 8 + Tailwind v4 (@theme tokens), inline SVG icons, no UI kit
target: static (design/prototype/), structured to port to React/Tailwind
shots: playwright
prefs: none (no ~/.claude/do-design/preferences.md, no .do-design/rules.md)
domains: devtools / QA
platforms: web (PWA), desktop-first + mobile reviewer (Android share target)

## Constraints from docs (SPEC wins over defaults)
- Tokens fixed: docs/SPEC/05-UI.md §5.2 (brand #2563EB, severity/status palettes, light+dark). Typography system UI + mono, base 16/1.5, h1 28/700, 4px spacing, radius 10, targets 44px.
- Never colour alone: §5.3 icon+text+shape map.
- Screens: §5.1 (Projects, Project, Contract, Run, Snippet, Settings, Onboarding, sheets). ComparisonView SPEC-UI-01.
- States: §5.4 StateNotice copy. A11y: §5.5 WCAG 2.1 AA.
- Logo: docs/brand/logo.svg (straight-segment C/U/I mark, stroke).

## Answers
depth: standard
product: web app (installable PWA)
platforms: responsive web, desktop-first; Android mobile reviewer (SPEC)
audience: professionals — solo devs with coding agents, agency leads (PRD §5)
goal: complete core task fast + trust evidence
scope: FULL product map — every screen, sheet, state; prototype represents completed app
directions: 1 recommended
brand: logo + colors (docs/brand, SPEC §5.2)
theme: follow system, both (S10)
personality: calm & precise
density: balanced
type: system UI sans + tabular mono accents (measurements, deltas, IDs, selectors)
color: assumed: neutral + one accent (brand blue for primary actions only; semantic palettes per SPEC)
spacing: 4px (SPEC)
radius: 10px (SPEC)
nav: top bar + project stepper
width: fluid full-width for split views; ~1200px cap for Projects/Settings
signature: evidence & measurement — ruler/caliper motif, dimension lines, delta callouts
a11y: WCAG 2.1 AA (SPEC §5.5) — floor 2.2 AA where it adds
icons: inline SVG line icons (SPEC: no icon font)
voice: assumed: plain & direct (SPEC copy)
motion: assumed: subtle functional, reduced-motion off
tech: static HTML/CSS/JS, structured to port to React+Tailwind v4

## Research
- Convergence: findings list left + tabbed evidence right; image lenses side-by-side / diff / toggle; colour does most status work (we beat it: icon+text+shape).
- Standout: done-checklists per stage (state what is outstanding) → stepper shows next action + outstanding items.
- Standout: evidence linked to cause (CSS/DOM) → measured delta (design / actual / Δ) beside crops with source of number.
- Gap: nobody labels provenance per result, nobody separates Explicit vs Inferred or Needs review/Not checked vs Fail → Engine chip + labels are differentiators; make them first-class.
- Gap: re-run deltas as summary bar rare → segmented summary bar reused for Resolved/Remaining/New/Regressed. Rejected (out of PRD scope / SPEC conflict): per-Finding Reviewed mark, single-key shortcuts, overlay slider.

## Direction
**Caliper** — a calm measuring instrument.
- Thesis: ConformUI's argument is 'measured, not guessed', so the UI reads like an instrument: quiet neutral chrome, mono tabular numbers, and dimension lines that show the measurement on the evidence itself.
- Palette (SPEC §5.2, fixed): bg #FFFFFF / surface #F6F7F9 / text #111827 / muted #4B5563 / brand #2563EB (primary action, links, focus, design-region outline) / diff #FF00FF overlay. Added supplements: border #E3E6EB (decorative hairline), surface-2 #EEF0F3, brand-bg #EFF4FF; dark mirrors.
- Type: system UI sans (SPEC; zero font files for offline PWA) + ui-monospace tabular for every number, ID, selector, source tag. Scale 12/14/16/20/28, weights 400/600/700; decisive jump body→h1; counts 28 mono.
- Shape: radius 10 on containers, 6 on chips/inputs (nested), hairline borders not shadows; shadow only on sheets. Fluid split panes; 4px grid.
- Signature: caliper — dimension lines with end ticks + mono delta callouts on ComparisonView and Contract canvas; stepper drawn as a ruler track with ticks. Logo geometry (straight segments, square caps) echoed.
- Motion: functional 150ms fades/outline moves; none under reduced-motion.
- Cost: system font = less typographic personality; character carried by mono numerals and caliper marks instead.
- Slop check: system stack alone is a tell → justified by SPEC + offline/perf; mono accents give voice. No gradients, no card soup (lists/tables/split panes), no KPI-card dashboard.

## Decisions
- User feedback 'all UIs look very messy': much calmer. No em dashes in UI copy. No pill/tinted chips; radius 3/4/6. 4 hues only (blue action, red fail, green pass, magenta diff); severity = shape+word in ink; Needs review = ink dashed icon. Removed SPEC tokens major/minor/review hues → SPEC §5.2 needs update (flag at handoff).
- Typeface: IBM Plex Sans + Plex Mono (code/IDs/dimension labels only). Deviates from SPEC 'system UI stack' → SPEC §5.2 + §2 stack (add @fontsource) need update.
- Deduped evidence: dimension lines + one measurements table; dropped delta box and summary bar.
- Direction: Caliper + grafts (user chose after 3-way compare; critic: Caliper 4/5, Audit 2/5, Workbench 3/5). Grafts: per-row Δ + worded EngineBadge on every Finding row (M-04); dashed shape for Inferred + Needs review rows; Copy fix prompt also docked in Finding detail; fix dark-mode review icon; 375 stepper keeps short labels; single summary (counts+bar merged).
- Rejected: serif display (breaks SPEC), onion-skin default lens (unreadable; not in SPEC).

## Changelog
- 2026-11-25 phase 0 setup
- 2026-11-25 phase 1 interview (standard), phase 2 research done
- 2026-11-25 phase 3 brief approved (incl. P1 surfaces)
- 2026-11-25 phase 4 direction: Caliper + grafts
- 2026-11-25 phase 5 system: tokens.json (contrast 0 fail), DESIGN.md, system.html; phase 6 build started (run.html reference; 3 screen-builders)
- Open: projects error uses invented code STORAGE_UNAVAILABLE (not in SPEC §5.4) → confirm/add to kernel ErrorCode
- 2026-11-25 phase 7 verify (2 passes), phase 8 handoff done
- 2026-11-25 layout: single-column pages centred (1120), tool views full-width (user question)
