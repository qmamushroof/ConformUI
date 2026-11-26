# 4.4 imaging + measure (deterministic engine)

**[◀ 4.3 ai-engine](04-03-AI-ENGINE.md)** · [SPEC index](../SPEC.md) · **[4.5 dom-snippet ▶](04-05-DOM-SNIPPET.md)**

Owns every number ConformUI shows (PRD-P-02, PRD-D-09, PRD-D-29). Split: `platform/imaging` (browser I/O: decode, resize, encode, crop) and `features/measure` (pure functions over `RgbaImage`, `DomSnapshot`, `Rect`; no DOM types, runs in Node tests, the page, a future Worker or an extension).

## 4.4.1 Public API

```ts
// platform/imaging -> implements kernel ImageCodec (normalise, pixels, crop, composePair, probe)
export function createImageCodec(): ImageCodec;
// features/measure -> implements kernel MeasureApi (signatures in §4.1.3)
export const measureApi: MeasureApi;            // align, snapRegion, locateOnCapture, regionDiff, inkRatio, dominantColour,
                                                // deltaE, matchElements, overflowFacts, overlaps, pct
export function inlineMeasureClient(): MeasureClient;   // async wrapper; used by app in release 1 (S22)
```

All rects are CSS px of the normalised image (1 image px = 1 CSS px after normalisation).

## 4.4.2 Image normalisation (`platform/imaging`, PRD-F-02.2, PRD-F-02.4, PRD-F-04.1)

| ID | Rule |
|---|---|
| `SPEC-MEAS-01` | Accept `image/png`, `image/jpeg`, `image/webp` up to 20 MiB and 8192 px per side (`SPEC-KERNEL-07`); else `IMAGE_UNSUPPORTED`/`IMAGE_TOO_LARGE` naming the limit. Decode with `createImageBitmap(blob, { imageOrientation: 'from-image' })`. |
| `SPEC-MEAS-02` | Normalise to `cssWidth` px wide (design: viewport preset; capture: `dom.viewport.width` when a snapshot exists, else the preset), height scaled proportionally, capped at 16 000 px (taller → `IMAGE_TOO_LARGE`, never cut). Resample with `OffscreenCanvas` (`imageSmoothingQuality: 'high'`), store as PNG (lossless for diffing). Re-encoding strips EXIF. |
| `SPEC-MEAS-03` | `crop(blob, rect, maxSide, mime)`: crop, downscale to `maxSide`, encode JPEG q0.85 (AI) or PNG (evidence thumbnails); returns base64 without the `data:` prefix (`role` `design`; callers override it); the rect is clamped to the image and an empty result is `IMAGE_DECODE_FAILED`. `composePair` puts design crop left, capture crop right on a white canvas with an 8 px gap, JPEG q0.85, role `pair`, the whole pair scaled down so its longest side is at most `maxSide`. |
| `SPEC-MEAS-04` | Viewport suggestion (PRD-F-02.3): source width / dpr candidates {1,2,3} closest to a preset within 5 % → that preset; else Desktop if ≥ 1024 CSS px else Mobile (release 1 presets: Desktop and Mobile; [P1] Tablet joins the candidates; width ≤ 0 or not finite → Desktop). User can change it. Implemented as kernel `suggestViewport` (`SPEC-KERNEL-12`) over `ImageCodec.probe`; `ProjectsService.suggestViewport(file)` composes them. |

## 4.4.3 Alignment (`SPEC-MEAS-05`, PRD-F-04.1, PRD-R-04)

Both images are already at CSS scale, so alignment = top-left anchored, same width (`Alignment`, §4.1.3). `width-mismatch` when |capture.cssWidth − design.cssWidth| / design.cssWidth > `width_mismatch_pct`: Visual checks for that viewport → Not checked (`misaligned`); Measured DOM checks still run, and the Run shows the issue. Height differences are reported, never cropped silently.

## 4.4.4 Region snapping and location (`SPEC-MEAS-06..08`, PRD-F-03.6, PRD-R-05)

| ID | Rule |
|---|---|
| `SPEC-MEAS-06` | **Background**: per region, the most frequent colour (5-bit-per-channel histogram) of the 1 px border of the region expanded by 16 px. A pixel is **ink** when OKLab distance to the background > 0.04. |
| `SPEC-MEAS-07` | **snapRegion(design, suggested)**: in `suggested` expanded by 24 px (clamped to image), compute the ink mask, close gaps ≤ 6 px (row/column run merge), take 4-connected components, and return the union bbox of components whose bbox intersects `suggested`. Accept if IoU(result, suggested) ≥ `snap_min_iou` or result lies fully inside suggested and covers ≥ 25 % of it; else `{ unresolved: true }` (Requirement shows region unresolved → its image-based checks are Needs review). Deterministic: same input, same rect. |
| `SPEC-MEAS-08` | **locateOnCapture**: search the design crop inside the capture over dy ∈ [−search_window_px, +search_window_px] (step 4 px, then refine ±3 at step 1) and dx ∈ [−24, 24] (step 4), on 1/4-scale grayscale, minimising mean absolute difference; ties → smallest |dy|, then |dx|. Returns the capture rect and a score 0..1 (1 − MAD/255). Used when no DOM match exists. |

## 4.4.5 Comparisons

| ID | Rule |
|---|---|
| `SPEC-MEAS-09` | **regionDiff**: crop both rects to equal size (min w/h), run `pixelmatch(a, b, out, w, h, { threshold: pixel_threshold, includeAA: false, diffColor: [255,0,255], diffMask: true })`; `diffRatio = diffPixels / (w·h)`. Anti-aliasing and sub-pixel text noise are ignored by `includeAA:false` (PRD-P-03). The mask feeds the diff overlay (PRD-F-05.1). |
| `SPEC-MEAS-10` | **Presence from image**: design ink ≥ 3 × `presence_ink_ratio` and capture ink (at the located rect, or the same rect when location score < 0.5) < `presence_ink_ratio` → missing. |
| `SPEC-MEAS-11` | **Colour (Measured, DOM only in P0)**: design colour = `dominantColour` on the snapped design region (median OKLab of ink pixels for `text`, background pixels for `background`, source `design-image`); observed = computed `color`/`backgroundColor` from the DOM snapshot converted to OKLab (`dom-snapshot`); `deltaE` = Euclidean OKLab distance; fail when > `colour_delta_e`. Without a DOM snapshot colour is Judged (S21). |
| `SPEC-MEAS-12` | **Geometry**: sizes and gaps from DOM boxes (`dom-snapshot`) when the matcher resolves, else from the located and snapped capture rect (`capture-image`). Positions are Judged-only in P0 (S21); design side only from snapped/user/sample regions (`design-image`). `pct` rounds to 1 decimal; displayed px values are integers. Every `Measurement` carries both source tags (PRD-M-03). |
| `SPEC-MEAS-13` | **DOM facts**: `overflowFacts.horizontalPx = max(0, document.scrollWidth − document.clientWidth)`; `overlaps` = pairs among visible `landmark`/`heading`/`button`/`link`/`image` elements, not ancestor/descendant, with intersection area ≥ 16 px² and ≥ 10 % of the smaller box; `clipped` from snapshot flags. |
| `SPEC-MEAS-14` | **matchElements**: filter by `selector` (exact string equality with snapshot selector), `tag`, `role`, `text` (case-insensitive, whitespace-collapsed substring), `within` (ancestor chain via `parent`), optional `region` (box centre inside the region scaled to the capture width); order by document order; `nth` picks one. |

## 4.4.6 Performance and purity

- `SPEC-MEAS-15`: measure functions take typed arrays and return plain data (structured-clone safe), so a Worker can host them later without API change ([Later], S22). Release 1 calls them through `inlineMeasureClient()` on the main thread, region-limited. Deterministic stages of the sample Run (2 viewports) ≤ 3 s on a mid-range laptop (PRD-F-04.4, PRD-M-08).
- `SPEC-MEAS-16`: no `Math.random`, no time, no locale-dependent formatting inside `measure` (PRD-P-10).

## 4.4.7 Acceptance tests (Node, `pngjs` decoding committed sample PNGs)

`SPEC-MEAS-07` snapping returns the committed sample Contract rects within 2 px for every sample region; `SPEC-MEAS-09` identical images → 0, same text rendered with different anti-aliasing → ratio < 0.01; `SPEC-MEAS-10` sample defect 1 detected missing on flawed, present on fixed; `SPEC-MEAS-13` sample mobile flawed: `horizontalPx = 64`, nav/h1 overlap found; fixed: 0 and none; `SPEC-MEAS-16` two runs → deep-equal output.
