# 9. Inputs and DOM Snippet

**[◀ 8. Feature Areas](08-FEATURE-AREAS.md)** · [PRD index](../PRD.md) · **[10. Demo ▶](10-DEMO.md)**

No live-URL capture and no backend (D-05). All inputs come from the user's device.

## F-02 Image inputs

| ID | Requirement | Priority |
|---|---|---|
| F-02.1 | Add design references and implementation captures by file picker, drag-and-drop and clipboard paste. | P0 |
| F-02.2 | Accept PNG, JPEG, WebP; the app normalises images for the engines (on-device accepts JPEG/PNG only — §7). Size limits are set in the SPEC and stated in the UI. | P0 |
| F-02.3 | Each image is assigned to a viewport (Desktop / Mobile; Tablet and custom width P1, F-08.1); the app suggests the viewport from image width and the user can change it. | P0 |
| F-02.4 | Full-page (tall) screenshots are supported; the design and capture are compared top-aligned at the same width. | P0 |
| F-02.5 | Android share target: share an image into the installed app (F-12.3). | P1 |
| F-02.6 | Replacing a capture keeps the Contract; it invalidates only that viewport's latest Run results. | P0 |

## F-13 DOM snippet (optional, high-value)

A small script the user copies from the app and runs on **their own page** (DevTools console, P0; bookmarklet, P1). It reads the rendered page and copies a JSON **DOM snapshot** to the clipboard; the user pastes it into the matching viewport's capture. It sends nothing over the network.

**Why:** screenshots give pixels; the snapshot gives real element boxes, text and styles, so Measured checks report exact values (e.g. CTA width, heading font size, overflow) without a backend or remote browser.

| ID | Requirement | Priority |
|---|---|---|
| F-13.1 | The app shows the snippet with a Copy button and three-step instructions (open your page at the target width → paste in DevTools console → paste result here). | P0 |
| F-13.2 | Snapshot contains: page URL and title, viewport width/height, device pixel ratio, document scroll width/height, capture timestamp, snippet version. | P0 |
| F-13.3 | For each visible meaningful element (landmarks, headings, links, buttons, images, form controls, text blocks; cap set in SPEC): tag, role, accessible name/text (truncated), a stable selector, bounding box in page coordinates, visibility, and key computed styles (typography, colour, box model, layout; exact list in SPEC). | P0 |
| F-13.4 | Overflow facts: whether the document scrolls horizontally, and elements extending beyond the viewport width or clipped by an ancestor. | P0 |
| F-13.5 | Pasted JSON is validated against a versioned schema; errors are explained; invalid snapshots are not stored. | P0 |
| F-13.6 | Snapshot viewport width should match the capture's viewport; a mismatch is warned and the user can still proceed. | P0 |
| F-13.7 | The snippet never reads form values, cookies, storage or hidden inputs; it reads layout, text and styles only. Size of the output is capped. | P0 |
| F-13.8 | Bookmarklet form of the same snippet (drag to bookmarks bar). | P1 |

## How the snapshot is used

| Use | Example |
|---|---|
| Measured size/position | "CTA width 132 px vs design 220 px." |
| Typography hierarchy | "h1 is 28 px; subtitle is 32 px — heading is not the dominant text." |
| Presence and content | "Navigation has 3 links; design shows 4." |
| Overflow and overlap | "Page scrolls horizontally by 64 px at 390 px width; nav overlaps hero heading." |
| Fix prompt precision | Selectors and computed values go into the Fix prompt. |

Without a snapshot, the same Requirements are checked from images (Visual / Judged), with lower confidence and no selectors.

Design references have no DOM. Geometric and colour design values come from snapped or user-set regions (source "design image"); expected counts or text come from the accepted Contract (source "contract"); implementation values come from the engine (source "engine") (P-02, F-03.6).
