# ConformUI design system

Source of truth: `design/tokens.json` → generated `tokens.css` (+ `tokens.tailwind.css` for the Tailwind v4 `@theme`). Never hardcode values. Components live in `prototype/assets/app.css`; reference screen: `prototype/run.html`.

## Principles
1. **Measured, not decorated.** The only expressive marks are caliper dimension lines, region outlines and diff overlays on evidence images. All chrome is plain text, spacing and hairlines.
2. **One loud thing per view.** There is one filled primary button. Everything else is a ghost button, a text link or the ⋯ menu. Colour means action (blue), Fail (red) or Pass (green), and nothing else.
3. **Provenance in words.** Every Requirement, Finding and trace row says which engine produced it ("Measured", "On-device", "Cloud", "Pre-computed"), and every number names its source ("DOM snapshot", "design image", "contract").

## Direction
**Caliper (calmed).** A quiet measuring instrument. Signature: dimension lines with end ticks and mono labels drawn on the design (solid blue) and implementation (dashed ink) crops. Everything else stays quiet: no chips, no pills, no tinted badges, no shadows except on sheets and menus.

## Copy rules
- No em dashes anywhere. Use a comma, a colon, a full stop or "and". The en dash is allowed only for numeric ranges ("202–238 px"), and the minus sign only for negative numbers ("−40%").
- Plain verbs on buttons: "Copy fix prompt", "Run", "Extract contract", "Send to cloud". Never "Get started", "Learn more", "Unlock" or "Seamless".
- Errors say what happened, what was kept and what to do. Copy for each code is in SPEC §5.4.
- Sentence case everywhere. Use real numbers from the sample (PRD §10) and never round fake metrics.

## Color (4 hues)
| Role | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #FFFFFF | neutral 950 | page |
| `--surface` | neutral 50 | neutral 900 | hover rows, drop zones, notices, code |
| `--surface-raised` | #FFFFFF | neutral 850 | sheets, menus |
| `--surface-sunken` | neutral 100 | neutral 1000 | segmented track, inline code, skeleton |
| `--border` | neutral 200 | neutral 800 | hairlines (decorative separation) |
| `--border-strong` | neutral 500 | neutral 500 | inputs, secondary buttons, tags (≥3:1) |
| `--text` / `--text-muted` / `--text-subtle` | 950 / 600 / 500 | 50 / 400 / 400 | body / meta / separators |
| `--accent` (+`-hover`, `-fg`, `-subtle`) | #2563EB | #60A5FA | primary button, links, focus, selected row, design-region outline |
| `--danger` | #B42318 | #FF8A80 | Fail, Remaining, Regressed, negative deltas, destructive |
| `--success` | #0F7A3A | #6FE39A | Pass, Resolved, privacy-ok dot |
| `--diff` | #FF00FF | same | diff overlay only, 60% opacity, never text |

Severity has **no hue**. It is shown by shape + word in ink: Critical ■ octagon filled, Major ▲ triangle filled, Minor ○ circle outline. Needs review uses ink with a dashed-circle "?" icon, and Inferred uses a dashed `tag`. Contrast: `node contrast.mjs tokens.json` → 64 pairs, 0 failing.

## Typography
IBM Plex Sans (400/500/600) for everything. IBM Plex Mono (400/500) only for code, selectors, IDs and dimension labels on evidence. Tabular figures are on globally. Production: self-host via `@fontsource/ibm-plex-sans` + `@fontsource/ibm-plex-mono` (Latin subset, ~70 KB woff2, precached).
| Token | Size / LH / weight | Use |
|---|---|---|
| `h1` | 28 / 1.2 / 600, −0.015em | one per route |
| `h2` | 20 / 1.35 / 600 | section, finding statement, sheet title |
| `h3` | 16 / 1.35 / 600 | sub-section |
| body | 16 / 1.5 / 400 | text, inputs |
| `.small` | 14 | meta, tables, buttons |
| `.xs` | 12 | list meta, IDs (never smaller) |

## Space · Radius · Elevation · Motion
- Space: 4-based. Use 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Inside a group the gap is 8 or 12; between groups 24–32; between page sections 32–48.
- Radius: 3 (tags), 4 (buttons, inputs, inline code), 6 (cards, panes, sheets, drop zones). No pills except 6 px dots.
- Elevation: `--elevation-menu`, `--elevation-sheet` only.
- Motion: 100/150/200 ms, `--ease-standard`. Used for hover colour, disclosure chevron, progress width and toast enter. All off under `prefers-reduced-motion`.

## Layout
- Header 56 px, sticky. Project header: breadcrumbs + steps (Design, Contract, Captures, Run, Fix, Re-verify), done = filled check, current = underline, next = blue.
- Split views (Run, Contract): list column 380 px + fluid detail (max 1040 px); stacks under 1100 px. Evidence pair stacks under 900 px.
- Single-column pages (Projects, Project, Settings, Snippet, Onboarding, 404): `.page`, centred, max 1120 px; the project bar contents share that column so crumbs align with the h1. Header stays full-width. Tool views (Run, Contract, Compare via `.page-wide`) are full-width from the 24 px gutter. Text max 68ch.
- Breakpoints 640 / 900 / 1100 / 1440. No horizontal page scroll at 320 px; tables and images scroll inside their own box.

## Components (classes in app.css)
| Component | Anatomy / variants | States | A11y |
|---|---|---|---|
| Header `[data-shell]` | brand · nav · engine status link · privacy link · Offline badge · mobile menu | current page, offline | `nav` landmark, `aria-current` |
| Project header `[data-phead]` | crumbs + `.steps` | done / current / next | `ol`, `aria-current="step"` |
| Button `.btn` | `-primary` (1 per view), default (outlined, forms and sheets), `-ghost` (toolbar), `-link`, `-danger` | hover, focus, active, disabled (`aria-disabled` + visible reason), busy (`aria-busy`) | 44 px min |
| Icon button `.iconbtn` | 44×44 | hover, focus | `aria-label` required |
| Toggle `.btn.toggle` | ghost button with `aria-pressed` | pressed = ink fill | `aria-pressed` |
| Menu `.menu-wrap > [data-menu] + .menu` | items: button/a | open, Esc closes | `aria-haspopup`, `aria-expanded` |
| Status `.st` | `-fail` `-pass` `-review` `-nc` icon + word | | text always present |
| Severity `.sev` | icon (critical/major/minor) + word in ink | | |
| Engine `.eng` | icon + word, muted | | `aria-label="Produced by …"` |
| Tag `.tag` | solid, `-dashed` (Inferred) | | |
| Meta line `.meta` | children auto-separated by "·" | | |
| Tabs `.tabs [role=tab]` | text + underline | selected | arrow keys |
| Segmented `.seg` | 2–4 options | pressed/checked | `radiogroup` or `aria-pressed` |
| Row list `.rows > .rowi` | icon · title · right value · meta | hover, selected (accent-subtle + 2 px bar) | `listbox`/`option`, Up/Down/Home/End/Enter |
| Evidence `.evidence > .fig` | caption (legend + size) + `.shot` svg/img | diff on (`.show-diff`) | `alt`/`aria-label` "Design: …" |
| Table `table.data` | text left, numbers `.r` right | `.val-fail` deltas, `tr.sel` | `th` headers |
| Disclosure `details.disc` | chevron · label · count · aside | open | native |
| Field `.field` | label · control (`.input` `.textarea` `.select`) · `.help` · `.error` | hover, focus, invalid (`aria-invalid`) | label bound, `aria-describedby` |
| Choice `.choice` | radio/checkbox + label + help | | |
| Drop zone `.drop` | button: icon, title, help | hover/drag-over, invalid | opens picker |
| Thumbnail `.thumb` | image · name/size · remove | | |
| Notice `.notice` | `-info` `-danger` default; icon · title · text · actions | | `role="status"`/`alert` |
| Empty `.empty` | h2 · one line · one primary | | |
| Progress `.bar` + `.stages` | per-stage list | running/done/waiting | `role="progressbar"` |
| Code `.code` | head (filename + Copy) + `pre` | | |
| Card `.card` | Projects only (discrete objects) | hover border | whole card is a link |
| Sheet `dialog.sheet` | head · body · foot (Cancel left of action) | `.wide` | `showModal`, Esc, focus returns; Cancel `autofocus` on cloud sheets |
| Send list `.sendlist` | item · bytes · total | | |
| Toast | ink bar, bottom centre | | `aria-live` |

## Do / Don't
- Do show status as icon + coloured word. Don't put status in a tinted pill.
- Do put secondary actions in ghost buttons or ⋯. Don't line up four outlined buttons.
- Do state each number once, on the evidence (dimension line) and in the measurements table. Don't add summary boxes that repeat them.
- Do separate with space first and hairlines second. Don't nest bordered boxes.
- Do use mono only for code, IDs, selectors and dimension labels. Don't use mono for headings, eyebrows or numbers in prose.
- Do write "Not checked: offline". Don't write "Not checked — offline".
