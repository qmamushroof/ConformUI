import type { Oklab, Rect, RgbaImage } from '@kernel';
import { oklabDistance, pixelOklab, rgbToOklab } from './oklab';

// Background and ink (SPEC-MEAS-06). Rects are pixel boxes, clamped to the image.

export const INK_DISTANCE = 0.04;
const BACKGROUND_MARGIN = 16;

export interface Box {
  x0: number;
  y0: number;
  x1: number; // exclusive
  y1: number; // exclusive
}

export const toBox = (r: Rect, img: RgbaImage, margin = 0): Box => ({
  x0: Math.max(0, Math.floor(r.x - margin)),
  y0: Math.max(0, Math.floor(r.y - margin)),
  x1: Math.min(img.width, Math.ceil(r.x + r.w + margin)),
  y1: Math.min(img.height, Math.ceil(r.y + r.h + margin)),
});

export const boxIsEmpty = (b: Box): boolean => !(b.x1 > b.x0 && b.y1 > b.y0);

/** Most frequent 5-bit-per-channel colour on the 1 px border of the region expanded by 16 px. */
export function backgroundOf(img: RgbaImage, region: Rect): Oklab {
  const b = toBox(region, img, BACKGROUND_MARGIN);
  if (boxIsEmpty(b)) return rgbToOklab(255, 255, 255);
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  const add = (x: number, y: number) => {
    const i = (y * img.width + x) * 4;
    const r = img.data[i] ?? 0;
    const g = img.data[i + 1] ?? 0;
    const bl = img.data[i + 2] ?? 0;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (bl >> 3);
    const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += bl;
    bins.set(key, e);
  };
  for (let x = b.x0; x < b.x1; x++) {
    add(x, b.y0);
    if (b.y1 - 1 > b.y0) add(x, b.y1 - 1);
  }
  for (let y = b.y0 + 1; y < b.y1 - 1; y++) {
    add(b.x0, y);
    if (b.x1 - 1 > b.x0) add(b.x1 - 1, y);
  }
  let bestKey = -1;
  let best = { n: 0, r: 0, g: 0, b: 0 };
  for (const [key, e] of bins) {
    if (e.n > best.n || (e.n === best.n && key < bestKey)) {
      best = e;
      bestKey = key;
    }
  }
  return rgbToOklab(best.r / best.n, best.g / best.n, best.b / best.n);
}

/** Ink mask over `box`: 1 where the OKLab distance to `bg` exceeds 0.04. Row-major, box-sized. */
export function inkMask(img: RgbaImage, box: Box, bg: Oklab): Uint8Array {
  const w = box.x1 - box.x0;
  const out = new Uint8Array(Math.max(0, w) * Math.max(0, box.y1 - box.y0));
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      if (oklabDistance(pixelOklab(img, x, y), bg) > INK_DISTANCE) out[(y - box.y0) * w + (x - box.x0)] = 1;
    }
  }
  return out;
}
