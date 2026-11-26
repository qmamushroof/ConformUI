import type { Measurement, Oklab, Rect, RgbaImage, Thresholds } from '@kernel';
import { boxIsEmpty, INK_DISTANCE, toBox } from './ink';
import { oklabDistance, pixelOklab, rgbToOklab } from './oklab';

// dominantColour and deltaE (SPEC-MEAS-11).

const median = (v: number[]): number => {
  const s = [...v].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};

/**
 * Median OKLab of the region's fill (`background`) or of the pixels that differ from the fill (`text`).
 * The fill is the most frequent 5-bit colour inside the region; with no ink, `text` falls back to the fill.
 */
export function dominantColour(img: RgbaImage, r: Rect, property: 'background' | 'text'): Oklab {
  const box = toBox(r, img);
  if (boxIsEmpty(box)) return rgbToOklab(255, 255, 255);
  const labs: Oklab[] = [];
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const i = (y * img.width + x) * 4;
      const pr = img.data[i] ?? 0;
      const pg = img.data[i + 1] ?? 0;
      const pb = img.data[i + 2] ?? 0;
      const key = ((pr >> 3) << 10) | ((pg >> 3) << 5) | (pb >> 3);
      const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++;
      e.r += pr;
      e.g += pg;
      e.b += pb;
      bins.set(key, e);
      labs.push(pixelOklab(img, x, y));
    }
  }
  let bestKey = -1;
  let best = { n: 0, r: 0, g: 0, b: 0 };
  for (const [key, e] of bins) {
    if (e.n > best.n || (e.n === best.n && key < bestKey)) {
      best = e;
      bestKey = key;
    }
  }
  const fill = rgbToOklab(best.r / best.n, best.g / best.n, best.b / best.n);
  const wantInk = property === 'text';
  const pick = labs.filter((p) => oklabDistance(p, fill) > INK_DISTANCE === wantInk);
  if (pick.length === 0) return fill;
  return { L: median(pick.map((p) => p.L)), a: median(pick.map((p) => p.a)), b: median(pick.map((p) => p.b)) };
}

export const deltaE = (a: Oklab, b: Oklab): number => oklabDistance(a, b);

/** A colour Measurement: design-image vs dom-snapshot; fails when deltaE > colour_delta_e. */
export function colourMeasurement(
  name: string,
  design: Oklab,
  observed: Oklab,
  t: Thresholds,
): { measurement: Measurement; pass: boolean } {
  const d = deltaE(design, observed);
  return {
    measurement: {
      name,
      design: 0,
      observed: d,
      unit: 'deltaE',
      delta: d,
      source: { design: 'design-image', observed: 'dom-snapshot' },
    },
    pass: d <= t.colour_delta_e,
  };
}
