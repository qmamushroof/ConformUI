# 4.5 dom-snippet

**[◀ 4.4 imaging + measure](04-04-MEASURE.md)** · [SPEC index](../SPEC.md) · **[4.6 projects + storage ▶](04-06-PROJECTS-STORAGE.md)**

`src/features/dom-snippet`. The copy-paste script the user runs on their own page, and parsing/validation of its JSON (PRD-F-13, PRD §9, PRD-D-04, PRD-D-24, PRD-R-11).

## 4.5.1 Public API

```ts
export const SNIPPET_VERSION = '1.0.0';
export const snippetSource: string;              // snippet.js imported with ?raw: inlined verbatim (not minified); kept small and readable so users can inspect what they run
export function bookmarkletHref(): string;       // [P1] 'javascript:' + encodeURIComponent(snippetSource) (PRD-F-13.8)
export function parseSnapshot(text: string, captureViewport: { cssWidth: number }): 
  { ok: true; snapshot: DomSnapshot; warnings: ('dom-viewport-mismatch' | 'truncated')[] } | { ok: false; errors: string[] };
export const SnippetPanel: React.FC<{ onCopy(): void }>;      // code block + Copy + 3 steps (PRD-F-13.1)
export const SnapshotPasteField: React.FC<{ viewport: ViewportId; cssWidth: number; onAccept(s: DomSnapshot): void }>;
```

## 4.5.2 Snapshot schema v1 (`SPEC-SNIP-01`, kernel zod `DomSnapshotV1`, PRD-F-13.2..13.4)

```ts
interface DomSnapshot { schema: 'conformui.dom-snapshot'; version: 1; snippetVersion: string;
  page: { url: string /*origin + pathname only*/; title: string /*≤120*/ }; capturedAt: string /*ISO*/;
  viewport: { width: number; height: number }; dpr: number;
  document: { scrollWidth: number; scrollHeight: number; clientWidth: number };
  overflow: { horizontal: boolean; horizontalPx: number };
  elements: DomElement[]; truncated: boolean }
interface DomElement { i: number; parent: number | null /*index of nearest captured ancestor*/;
  kind: 'landmark' | 'heading' | 'link' | 'button' | 'image' | 'control' | 'text';
  tag: string; role?: string; level?: number /*h1..h6*/; name?: string /*accessible name ≤120*/; text?: string /*≤200*/;
  selector: string; box: Rect /*page coords: getBoundingClientRect + scrollX/Y, 2 decimals*/; visible: boolean;
  style: { fontSize: number; fontWeight: number; lineHeight: number | null; fontFamily: string /*first family*/;
    color: string; backgroundColor: string; display: string; position: string; overflowX: string;
    marginTop: number; marginBottom: number; paddingTop: number; paddingBottom: number; gap: number | null; borderRadius: number; opacity: number };
  flags: { beyondViewport: boolean; clippedByAncestor: boolean; textClipped: boolean } }
```

## 4.5.3 Snippet behaviour (`snippet.js`, plain ES2020, no imports, one IIFE)

| ID | Rule |
|---|---|
| `SPEC-SNIP-02` | Element selection, document order: landmarks (`header, nav, main, footer, aside, section[aria-label], [role=banner\|navigation\|main\|contentinfo]`), `h1–h6`, `a[href]`, `button, [role=button]`, `img, svg[role=img], picture, [role=img]`, `input:not([type=hidden]), select, textarea` (kind `control`), and text blocks (`p, li, span, label` whose own trimmed text ≥ 2 chars and that have no captured block child). Skip elements with zero area or `display:none`/`visibility:hidden` (recorded only if a landmark, `visible:false`). Cap 1500 elements; set `truncated`. |
| `SPEC-SNIP-03` | Selector: `#id` if the id is unique and not auto-generated-looking (`/\d{4,}\|[a-f0-9]{8,}/`); else `[data-testid="…"]` if present; else `tag:nth-of-type(n)` path from the nearest ancestor with a usable id (or `body`), max 5 levels. Deterministic for the same DOM. |
| `SPEC-SNIP-04` | Accessible name: `aria-label` → `aria-labelledby` text → `alt` → `<label for>` text → `title` → own text; truncated to 120 chars. `text` = `innerText` of non-control elements, whitespace-collapsed, truncated to 200. |
| `SPEC-SNIP-05` | Overflow: `horizontal = scrollWidth > clientWidth`; `beyondViewport` = box right > `clientWidth` + 1 or left < −1; `clippedByAncestor` = box not contained in an ancestor with `overflow` ≠ `visible`; `textClipped` = `scrollWidth > clientWidth + 1` with `overflow-x`/`text-overflow` hiding it. |
| `SPEC-SNIP-06` | Output: `JSON.stringify(snapshot)`; if > 1 MiB, drop `text` of `kind:'text'` elements, then halve elements from the end, set `truncated`. Copies with DevTools `copy(json)` when `typeof copy === 'function'`, else `console.log(json)`; returns the string `ConformUI snapshot copied: N elements, W×H` (DevTools prints it). |

## 4.5.4 Privacy guarantees (`SPEC-SNIP-07`, PRD-F-13.7, PRD-D-24)

- Reads layout, text and computed styles only. Never reads `.value`, `.checked`, `.selectedIndex`, `input[type=hidden]`, `[type=password]` text, `document.cookie`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator.credentials`; form controls record tag, role, name, box, style only.
- No network: the source contains none of `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `import(`, `new Image`, `.src =`, `location =`, `window.open`, `postMessage`. Page URL is reduced to origin + pathname (query and hash dropped).
- No DOM mutation (no `appendChild`, `innerHTML =`, `setAttribute`, style writes).

## 4.5.5 Paste validation (`SPEC-SNIP-08`, PRD-F-13.5, PRD-F-13.6)

`parseSnapshot`: takes the text from the first `{` to the last `}` (tolerates BOM, whitespace and console noise such as the snippet's "ConformUI snapshot copied" line); that JSON ≤ 1 MiB (bytes) else `SNAPSHOT_TOO_LARGE`; `JSON.parse` error → "Not valid JSON (line L)"; zod errors → up to 5 human messages ("elements[12].box.w must be a number"); wrong `schema`/`version` → "This is not a ConformUI snapshot v1". Invalid snapshots are never stored (PRD-F-13.5); the Run proceeds image-only with DOM-based Measured checks Not checked (`no-dom-snapshot`). `|viewport.width − cssWidth| > 1` → warning `dom-viewport-mismatch` shown with "Use anyway" (PRD-F-13.6); `truncated: true` → warning `truncated`.

## 4.5.6 Acceptance tests

- Test for `SPEC-SNIP-07` (static): unit test scans `snippet.js` for the banned tokens above.
- Test for `SPEC-SNIP-07` (runtime, Playwright): run the snippet on `sample-site/flawed/` with a filled form field holding `SECRET-VALUE-123` and a cookie; assert zero network requests during execution, and the output contains neither value.
- Test for `SPEC-SNIP-02..05`: snapshot of `sample-site/flawed/` at 390 px has `overflow.horizontalPx = 64` and nav link count 3; at 1440 px CTA box width 132.
- Test for `SPEC-SNIP-08`: fixtures for invalid JSON, wrong version, oversized, mismatched width.
