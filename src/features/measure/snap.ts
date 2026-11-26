import type { Rect, RgbaImage, Thresholds } from '@kernel';
import { backgroundOf, boxIsEmpty, inkMask, toBox } from './ink';

// snapRegion (SPEC-MEAS-07): ink mask in the suggested rect + 24 px, gaps <= 6 px closed, 4-connected components,
// union of components touching the suggestion. Pure and deterministic.

const SEARCH_MARGIN = 24;
const MAX_GAP = 6;
const MIN_COVER = 0.25;

function closeRuns(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = Uint8Array.from(mask);
  const fill = (start: number, step: number, len: number) => {
    let last = -1;
    for (let i = 0; i < len; i++) {
      if (!mask[start + i * step]) continue;
      if (last >= 0 && i - last - 1 <= MAX_GAP) for (let k = last + 1; k < i; k++) out[start + k * step] = 1;
      last = i;
    }
  };
  for (let y = 0; y < h; y++) fill(y * w, 1, w);
  for (let x = 0; x < w; x++) fill(x, w, h);
  return out;
}

const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h);

export function iou(a: Rect, b: Rect): number {
  const iw = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const ih = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  return inter / (area(a) + area(b) - inter);
}

export function snapRegion(
  img: RgbaImage,
  suggested: Rect,
  t: Thresholds,
): { rect: Rect; iou: number } | { unresolved: true } {
  const unresolved = { unresolved: true } as const;
  if (boxIsEmpty(toBox(suggested, img))) return unresolved;
  const box = toBox(suggested, img, SEARCH_MARGIN);
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const mask = closeRuns(inkMask(img, box, backgroundOf(img, suggested)), w, h);

  const seen = new Uint8Array(mask.length);
  const stack: number[] = [];
  let ux0 = Number.POSITIVE_INFINITY;
  let uy0 = Number.POSITIVE_INFINITY;
  let ux1 = Number.NEGATIVE_INFINITY;
  let uy1 = Number.NEGATIVE_INFINITY;
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    seen[s] = 1;
    stack.push(s);
    while (stack.length > 0) {
      const p = stack.pop() as number;
      const px = p % w;
      const py = (p - px) / w;
      x0 = Math.min(x0, px);
      x1 = Math.max(x1, px);
      y0 = Math.min(y0, py);
      y1 = Math.max(y1, py);
      for (const [nx, ny] of [
        [px - 1, py],
        [px + 1, py],
        [px, py - 1],
        [px, py + 1],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (mask[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    const cx0 = x0 + box.x0;
    const cy0 = y0 + box.y0;
    const cx1 = x1 + 1 + box.x0;
    const cy1 = y1 + 1 + box.y0;
    const touches =
      cx0 < suggested.x + suggested.w && cx1 > suggested.x && cy0 < suggested.y + suggested.h && cy1 > suggested.y;
    if (!touches) continue;
    ux0 = Math.min(ux0, cx0);
    uy0 = Math.min(uy0, cy0);
    ux1 = Math.max(ux1, cx1);
    uy1 = Math.max(uy1, cy1);
  }
  if (ux1 < 0) return unresolved;
  const rect: Rect = { x: ux0, y: uy0, w: ux1 - ux0, h: uy1 - uy0 };
  const score = iou(rect, suggested);
  const inside =
    rect.x >= suggested.x &&
    rect.y >= suggested.y &&
    rect.x + rect.w <= suggested.x + suggested.w &&
    rect.y + rect.h <= suggested.y + suggested.h;
  if (score >= t.snap_min_iou || (inside && area(rect) >= MIN_COVER * area(suggested))) return { rect, iou: score };
  return unresolved;
}
