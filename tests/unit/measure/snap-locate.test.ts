import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Rect, RgbaImage } from '@kernel';
import { measureApi } from '@measure';
import { describe, expect, it } from 'vitest';
import { createNodeImageCodec, solidImage } from '../../helpers/node-codec';
import { thresholds } from '../../helpers/samples';

const t = thresholds();
const codec = createNodeImageCodec();
const sampleDir = resolve(__dirname, '../../../src/features/demo/sample');

type Rgb = [number, number, number];

function paint(img: RgbaImage, r: Rect, rgb: Rgb) {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) img.data.set([...rgb, 255], (y * img.width + x) * 4);
  }
}
const canvas = (w: number, h: number, bg: Rgb = [255, 255, 255]) => solidImage(w, h, [...bg, 255]);
const sample = (name: string) =>
  codec.pixels(new Blob([readFileSync(resolve(sampleDir, name))], { type: 'image/png' }));

// The committed design capture is 2x; halve it (2x2 box average) to CSS scale.
async function designAtCss(): Promise<RgbaImage> {
  const src = await sample('design-desktop.png');
  const out = canvas(src.width / 2, Math.floor(src.height / 2));
  const offsets = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const;
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (const [dx, dy] of offsets) sum += src.data[((2 * y + dy) * src.width + 2 * x + dx) * 4 + c] ?? 0;
        out.data[(y * out.width + x) * 4 + c] = Math.round(sum / 4);
      }
    }
  }
  return out;
}

const within = (a: Rect, b: Rect, px: number) =>
  Math.abs(a.x - b.x) <= px && Math.abs(a.y - b.y) <= px && Math.abs(a.w - b.w) <= px && Math.abs(a.h - b.h) <= px;

describe('SPEC-MEAS-06/07 snapRegion', () => {
  const box: Rect = { x: 100, y: 80, w: 60, h: 30 };
  const base = (bg: Rgb = [255, 255, 255]) => {
    const img = canvas(300, 200, bg);
    paint(img, box, [30, 90, 200]);
    return img;
  };

  it('SPEC-MEAS-07 snaps a loose suggestion to the ink bbox on a uniform background', () => {
    const r = measureApi.snapRegion(base(), { x: 92, y: 74, w: 76, h: 42 }, t);
    expect('rect' in r && r.rect).toEqual(box);
  });

  it('SPEC-MEAS-06 works on a coloured uniform background', () => {
    const r = measureApi.snapRegion(base([20, 20, 40]), { x: 95, y: 75, w: 70, h: 40 }, t);
    expect('rect' in r && r.rect).toEqual(box);
  });

  it('SPEC-MEAS-06 works on a smooth gradient background', () => {
    const img = canvas(300, 200);
    for (let y = 0; y < 200; y++) {
      for (let x = 0; x < 300; x++) {
        const v = 250 - Math.floor(x / 20);
        img.data.set([v, v, 255, 255], (y * 300 + x) * 4);
      }
    }
    paint(img, box, [30, 30, 30]);
    const r = measureApi.snapRegion(img, { x: 90, y: 70, w: 80, h: 50 }, t);
    expect('rect' in r && r.rect).toEqual(box);
  });

  it('SPEC-MEAS-06 ignores low-amplitude noise below the ink distance', () => {
    const img = canvas(300, 200);
    for (let i = 0; i < 300 * 200; i++) {
      const n = (i * 7919) % 5;
      img.data.set([250 + n, 250 + n, 250 + n, 255], i * 4);
    }
    paint(img, box, [30, 30, 30]);
    const r = measureApi.snapRegion(img, { x: 90, y: 70, w: 80, h: 50 }, t);
    expect('rect' in r && r.rect).toEqual(box);
  });

  it('SPEC-MEAS-07 a faint anti-aliasing ring below the ink distance does not grow the box', () => {
    const img = canvas(300, 200);
    paint(img, { x: 99, y: 79, w: 62, h: 32 }, [253, 253, 253]);
    paint(img, box, [30, 90, 200]);
    const r = measureApi.snapRegion(img, { x: 92, y: 74, w: 76, h: 42 }, t);
    expect('rect' in r && r.rect).toEqual(box);
  });

  it('SPEC-MEAS-07 closes gaps of 6 px or less, keeping two halves as one element', () => {
    const img = canvas(300, 200);
    paint(img, { x: 100, y: 80, w: 25, h: 30 }, [30, 30, 30]);
    paint(img, { x: 131, y: 80, w: 29, h: 30 }, [30, 30, 30]); // 6 px gap
    const r = measureApi.snapRegion(img, { x: 95, y: 75, w: 70, h: 40 }, t);
    expect('rect' in r && r.rect).toEqual({ x: 100, y: 80, w: 60, h: 30 });
  });

  it('SPEC-MEAS-07 does not merge across a gap larger than 6 px', () => {
    const img = canvas(300, 200);
    paint(img, { x: 100, y: 80, w: 25, h: 30 }, [30, 30, 30]);
    paint(img, { x: 150, y: 80, w: 10, h: 30 }, [30, 30, 30]); // 25 px gap
    const r = measureApi.snapRegion(img, { x: 98, y: 78, w: 30, h: 34 }, t);
    expect('rect' in r && r.rect).toEqual({ x: 100, y: 80, w: 25, h: 30 });
  });

  it('SPEC-MEAS-07 snaps to the nearest ink edge within 24 px and excludes unrelated ink', () => {
    const img = base();
    paint(img, { x: 200, y: 150, w: 20, h: 20 }, [200, 0, 0]);
    const r = measureApi.snapRegion(img, { x: 80, y: 60, w: 100, h: 70 }, t);
    expect('rect' in r && r.rect).toEqual(box);
  });

  it('SPEC-MEAS-07 is deterministic', () => {
    const img = base();
    const s = { x: 92, y: 74, w: 76, h: 42 };
    expect(measureApi.snapRegion(img, s, t)).toEqual(measureApi.snapRegion(img, s, t));
  });

  it('SPEC-MEAS-07 reports iou with the suggestion', () => {
    const r = measureApi.snapRegion(base(), { x: 100, y: 80, w: 60, h: 30 }, t);
    expect('iou' in r && r.iou).toBe(1);
  });

  it('SPEC-MEAS-07 accepts a result fully inside a large suggestion when it covers at least 25 percent', () => {
    const img = canvas(400, 300);
    paint(img, { x: 50, y: 50, w: 100, h: 100 }, [30, 30, 30]);
    // IoU = 10000 / 40000 = 0.25 < 0.3, but the result is inside and covers 25 %.
    const r = measureApi.snapRegion(img, { x: 50, y: 50, w: 200, h: 200 }, t);
    expect('rect' in r && r.rect).toEqual({ x: 50, y: 50, w: 100, h: 100 });
  });

  it('SPEC-MEAS-07 is unresolved when a small inside result covers under 25 percent and IoU is below the minimum', () => {
    const img = canvas(400, 300);
    paint(img, { x: 100, y: 100, w: 20, h: 20 }, [30, 30, 30]);
    expect(measureApi.snapRegion(img, { x: 50, y: 50, w: 200, h: 200 }, t)).toEqual({ unresolved: true });
  });

  it('SPEC-MEAS-07 is unresolved for an empty region with no ink', () => {
    expect(measureApi.snapRegion(canvas(300, 200), { x: 100, y: 80, w: 60, h: 30 }, t)).toEqual({ unresolved: true });
  });

  it('SPEC-MEAS-07 is unresolved when the suggestion is outside the image or has no area', () => {
    const img = base();
    expect(measureApi.snapRegion(img, { x: 1000, y: 1000, w: 50, h: 50 }, t)).toEqual({ unresolved: true });
    expect(measureApi.snapRegion(img, { x: 100, y: 80, w: 0, h: 30 }, t)).toEqual({ unresolved: true });
  });

  it('SPEC-MEAS-07 handles elements touching the image edge', () => {
    const img = canvas(200, 100);
    paint(img, { x: 0, y: 0, w: 50, h: 20 }, [30, 30, 30]);
    paint(img, { x: 150, y: 80, w: 50, h: 20 }, [30, 30, 30]);
    const a = measureApi.snapRegion(img, { x: 0, y: 0, w: 60, h: 30 }, t);
    expect('rect' in a && a.rect).toEqual({ x: 0, y: 0, w: 50, h: 20 });
    const b = measureApi.snapRegion(img, { x: 140, y: 70, w: 70, h: 40 }, t);
    expect('rect' in b && b.rect).toEqual({ x: 150, y: 80, w: 50, h: 20 });
  });

  it('SPEC-MEAS-07 snaps the sample CTA and hero on the design within 2 px', async () => {
    const design = await designAtCss();
    const cta = measureApi.snapRegion(design, { x: 112, y: 384, w: 236, h: 68 }, t);
    expect('rect' in cta && within(cta.rect, { x: 120, y: 392.8, w: 220, h: 52 }, 2)).toBe(true);
    const hero = measureApi.snapRegion(design, { x: 110, y: 126, w: 1220, h: 420 }, t);
    expect('rect' in hero && within(hero.rect, { x: 120, y: 136, w: 1200, h: 400 }, 2)).toBe(true);
  });
});

describe('SPEC-MEAS-08 locateOnCapture', () => {
  function page(seed: number, w = 400, h = 300) {
    const img = canvas(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let hash = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) | 0;
        hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
        const v = (hash ^ (hash >>> 16)) & 255;
        img.data.set([v, v, v, 255], (y * w + x) * 4);
      }
    }
    return img;
  }
  const shift = (src: RgbaImage, dx: number, dy: number) => {
    const out = canvas(src.width, src.height);
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const sx = x - dx;
        const sy = y - dy;
        if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
        const from = (sy * src.width + sx) * 4;
        out.data.set(src.data.subarray(from, from + 4), (y * out.width + x) * 4);
      }
    }
    return out;
  };
  const dr: Rect = { x: 150, y: 100, w: 80, h: 60 };

  it('SPEC-MEAS-08 identical images give the same rect and score 1', () => {
    const d = page(1);
    const r = measureApi.locateOnCapture(d, dr, d, t);
    expect(r.rect).toEqual(dr);
    expect(r.score).toBe(1);
  });

  it('SPEC-MEAS-08 finds a vertically shifted crop, including non-multiples of 4', () => {
    const d = page(2);
    for (const dy of [4, 24, -17, 33, -1]) {
      const r = measureApi.locateOnCapture(d, dr, shift(d, 0, dy), t);
      expect(r.rect).toEqual({ ...dr, y: dr.y + dy });
      expect(r.score).toBeGreaterThan(0.99);
    }
  });

  it('SPEC-MEAS-08 finds a horizontal shift within 24 px', () => {
    const d = page(3);
    const r = measureApi.locateOnCapture(d, dr, shift(d, -12, 8), t);
    expect(r.rect).toEqual({ ...dr, x: dr.x - 12, y: dr.y + 8 });
  });

  it('SPEC-MEAS-08 does not search beyond search_window_px', () => {
    const d = page(4, 400, 500);
    const r = measureApi.locateOnCapture(d, dr, shift(d, 0, 60), { ...t, search_window_px: 20 });
    expect(Math.abs(r.rect.y - dr.y)).toBeLessThanOrEqual(23);
  });

  it('SPEC-MEAS-08 ties go to the smallest |dy|, then |dx|, then the smaller offset', () => {
    const flat = canvas(300, 300);
    const same = measureApi.locateOnCapture(flat, { x: 100, y: 100, w: 40, h: 40 }, flat, t);
    expect(same.rect).toEqual({ x: 100, y: 100, w: 40, h: 40 });
    expect(same.score).toBe(1);

    // Two copies equally far above and below: dy = -40 beats dy = +40.
    const d = canvas(300, 300);
    paint(d, { x: 100, y: 120, w: 40, h: 40 }, [0, 0, 0]);
    const c = canvas(300, 300);
    paint(c, { x: 100, y: 80, w: 40, h: 40 }, [0, 0, 0]);
    paint(c, { x: 100, y: 160, w: 40, h: 40 }, [0, 0, 0]);
    expect(measureApi.locateOnCapture(d, { x: 100, y: 120, w: 40, h: 40 }, c, t).rect.y).toBe(80);

    // Copies at dx = -8 and +8: the smaller dx wins.
    const c2 = canvas(300, 300);
    paint(c2, { x: 92, y: 120, w: 10, h: 40 }, [0, 0, 0]);
    paint(c2, { x: 108, y: 120, w: 10, h: 40 }, [0, 0, 0]);
    const d2 = canvas(300, 300);
    paint(d2, { x: 100, y: 120, w: 10, h: 40 }, [0, 0, 0]);
    expect(measureApi.locateOnCapture(d2, { x: 100, y: 120, w: 10, h: 40 }, c2, t).rect.x).toBe(92);
  });

  it('SPEC-MEAS-08 a crop at the image edge never leaves the capture', () => {
    const d = page(5);
    const edge: Rect = { x: 0, y: 0, w: 60, h: 40 };
    const r = measureApi.locateOnCapture(d, edge, shift(d, 0, 12), t);
    expect(r.rect).toEqual({ ...edge, y: 12 });
  });

  it('SPEC-MEAS-08 handles a crop smaller than a 4 px block', () => {
    const d = canvas(120, 120);
    paint(d, { x: 50, y: 50, w: 3, h: 3 }, [0, 0, 0]);
    const c = canvas(120, 120);
    paint(c, { x: 50, y: 59, w: 3, h: 3 }, [0, 0, 0]);
    expect(measureApi.locateOnCapture(d, { x: 50, y: 50, w: 3, h: 3 }, c, t).rect).toEqual({
      x: 50,
      y: 59,
      w: 3,
      h: 3,
    });
  });

  it('SPEC-MEAS-08 an unrelated capture scores low and a crop larger than the capture scores 0', () => {
    expect(measureApi.locateOnCapture(page(6), dr, page(99), t).score).toBeLessThan(0.9);
    expect(measureApi.locateOnCapture(page(6), { x: 0, y: 0, w: 400, h: 300 }, canvas(100, 100), t).score).toBe(0);
  });

  it('SPEC-MEAS-08 is deterministic', () => {
    const d = page(7);
    const c = shift(d, 0, 11);
    expect(measureApi.locateOnCapture(d, dr, c, t)).toEqual(measureApi.locateOnCapture(d, dr, c, t));
  });

  it('SPEC-MEAS-08 locates the sample CTA and hero on the fixed capture', async () => {
    const design = await designAtCss();
    const fixed = await sample('fixed-desktop.png');
    const cta: Rect = { x: 120, y: 393, w: 220, h: 52 };
    const onFixed = measureApi.locateOnCapture(design, cta, fixed, t);
    expect(Math.abs(onFixed.rect.y - 393)).toBeLessThanOrEqual(2);
    expect(Math.abs(onFixed.rect.x - 120)).toBeLessThanOrEqual(2);
    expect(onFixed.score).toBeGreaterThan(0.9);
    const hero: Rect = { x: 120, y: 136, w: 1200, h: 400 };
    expect(within(measureApi.locateOnCapture(design, hero, fixed, t).rect, hero, 2)).toBe(true);
  });

  it('SPEC-MEAS-08 locates the sample CTA on the flawed capture near its shifted position', async () => {
    const design = await designAtCss();
    const flawed = await sample('flawed-desktop.png');
    const r = measureApi.locateOnCapture(design, { x: 120, y: 393, w: 220, h: 52 }, flawed, t);
    expect(r.rect.y).toBeGreaterThan(393);
    expect(r.rect.y).toBeLessThanOrEqual(393 + 160);
  });
});
