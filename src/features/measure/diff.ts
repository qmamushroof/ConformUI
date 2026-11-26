import type { Rect, RgbaImage, Thresholds } from '@kernel';
import pixelmatch from 'pixelmatch';
import { backgroundOf, boxIsEmpty, inkMask, toBox } from './ink';

// regionDiff (SPEC-MEAS-09), inkRatio and presence (SPEC-MEAS-10).

function cropData(img: RgbaImage, x0: number, y0: number, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const s = ((y0 + y) * img.width + x0) * 4;
    out.set(img.data.subarray(s, s + w * 4), y * w * 4);
  }
  return out;
}

export function regionDiff(
  design: RgbaImage,
  dr: Rect,
  capture: RgbaImage,
  cr: Rect,
  t: Thresholds,
): { diffRatio: number; diffMask: Uint8ClampedArray } {
  const a = toBox(dr, design);
  const b = toBox(cr, capture);
  const w = Math.min(a.x1 - a.x0, b.x1 - b.x0);
  const h = Math.min(a.y1 - a.y0, b.y1 - b.y0);
  if (boxIsEmpty(a) || boxIsEmpty(b) || w <= 0 || h <= 0) return { diffRatio: 0, diffMask: new Uint8ClampedArray(0) };
  const out = new Uint8ClampedArray(w * h * 4);
  const diff = pixelmatch(cropData(design, a.x0, a.y0, w, h), cropData(capture, b.x0, b.y0, w, h), out, w, h, {
    threshold: t.pixel_threshold,
    includeAA: false,
    diffColor: [255, 0, 255],
    diffMask: true,
  });
  return { diffRatio: diff / (w * h), diffMask: out };
}

/** Fraction of pixels in `r` that are ink against the region's own background (SPEC-MEAS-06). */
export function inkRatio(img: RgbaImage, r: Rect): number {
  const box = toBox(r, img);
  if (boxIsEmpty(box)) return 0;
  const mask = inkMask(img, box, backgroundOf(img, r));
  let n = 0;
  for (const v of mask) n += v;
  return n / mask.length;
}

/** SPEC-MEAS-10: true when the design region has ink but the capture region does not. */
export function presenceMissing(
  design: RgbaImage,
  dr: Rect,
  capture: RgbaImage,
  located: Rect,
  locateScore: number,
  t: Thresholds,
): boolean {
  if (inkRatio(design, dr) < 3 * t.presence_ink_ratio) return false;
  return inkRatio(capture, locateScore < 0.5 ? dr : located) < t.presence_ink_ratio;
}
