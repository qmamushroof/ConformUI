import { contextRect, planLetterbox, planPairLayout, type Rect, rectFromNormalised, rectToNormalised } from '@kernel';
import { describe, expect, it } from 'vitest';

// Letterboxing for the on-device model (SPEC-AI-11): a square canvas with neutral padding, so Chrome never stretches.

describe('planLetterbox', () => {
  it('a wide band is scaled to the max side and centred vertically in a square', () => {
    const lb = planLetterbox(1440, 864, 1024);
    expect(lb.side).toBe(1024);
    expect(lb.w).toBe(1024);
    expect(lb.h).toBe(614);
    expect(lb.dx).toBe(0);
    expect(lb.dy).toBe(205);
  });

  it('a tall image is centred horizontally', () => {
    const lb = planLetterbox(390, 624, 1024);
    expect(lb.side).toBe(624);
    expect(lb.h).toBe(624);
    expect(lb.w).toBe(390);
    expect(lb.dx).toBe(117);
    expect(lb.dy).toBe(0);
  });

  it('a square image has no padding', () => {
    const lb = planLetterbox(500, 500, 1024);
    expect([lb.dx, lb.dy, lb.w, lb.h, lb.side]).toEqual([0, 0, 500, 500, 500]);
  });

  it('an image larger than max side shrinks, never above it', () => {
    const lb = planLetterbox(4000, 3000, 1024);
    expect(lb.side).toBe(1024);
    expect(lb.h).toBe(768);
  });

  it('a tiny image is enlarged (at most 2x) so the model has pixels to read', () => {
    const lb = planLetterbox(100, 50, 1024);
    expect(lb.w).toBe(200);
    expect(lb.h).toBe(100);
    expect(lb.side).toBe(200);
  });

  it('never returns a zero size, even for a 1 px sliver', () => {
    const lb = planLetterbox(1, 1000, 1024);
    expect(lb.w).toBeGreaterThanOrEqual(1);
    expect(lb.h).toBeGreaterThanOrEqual(1);
    expect(lb.side).toBe(Math.max(lb.w, lb.h));
  });
});

describe('rect <-> normalised round trip through the letterbox', () => {
  const cases: [string, Rect, Rect][] = [
    ['wide band, box mid-image', { x: 0, y: 864, w: 1440, h: 136 }, { x: 200, y: 900, w: 300, h: 40 }],
    ['wide band, whole image', { x: 0, y: 0, w: 1440, h: 864 }, { x: 0, y: 0, w: 1440, h: 864 }],
    ['tall mobile band, box at the right edge', { x: 0, y: 624, w: 390, h: 624 }, { x: 300, y: 700, w: 90, h: 40 }],
    ['square', { x: 10, y: 10, w: 400, h: 400 }, { x: 110, y: 110, w: 100, h: 100 }],
    ['tiny region', { x: 100, y: 100, w: 60, h: 20 }, { x: 110, y: 105, w: 20, h: 10 }],
    ['box in the bottom-right corner', { x: 0, y: 0, w: 1440, h: 864 }, { x: 1340, y: 764, w: 100, h: 100 }],
  ];
  for (const [name, src, box] of cases) {
    it(`${name}`, () => {
      const lb = planLetterbox(src.w, src.h, 1024);
      const n = rectToNormalised(box, src, lb);
      for (const v of n) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1000);
      }
      const back = rectFromNormalised(n, src, lb);
      expect(back.x).toBeCloseTo(box.x, 0);
      expect(back.y).toBeCloseTo(box.y, 0);
      expect(back.w).toBeCloseTo(box.w, 0);
      expect(back.h).toBeCloseTo(box.h, 0);
    });
  }

  it('normalised order is [ymin, xmin, ymax, xmax]', () => {
    const src = { x: 0, y: 0, w: 1000, h: 1000 };
    const lb = planLetterbox(1000, 1000, 1000);
    expect(rectToNormalised({ x: 100, y: 200, w: 300, h: 400 }, src, lb)).toEqual([200, 100, 600, 400]);
    expect(rectFromNormalised([200, 100, 600, 400], src, lb)).toEqual({ x: 100, y: 200, w: 300, h: 400 });
  });

  it('a box that sits in the padding is clamped to the image, not placed outside it', () => {
    const src = { x: 0, y: 0, w: 1440, h: 864 };
    const lb = planLetterbox(1440, 864, 1024); // padding rows 0..205 and 819..1024
    const r = rectFromNormalised([0, 0, 100, 1000], src, lb);
    expect(r.y).toBe(0);
    expect(r.y + r.h).toBeLessThanOrEqual(864);
    expect(r.h).toBeGreaterThanOrEqual(1);
    const bottom = rectFromNormalised([950, 0, 1000, 1000], src, lb);
    expect(bottom.y + bottom.h).toBeLessThanOrEqual(864);
    expect(bottom.h).toBeGreaterThanOrEqual(1);
  });

  it('swapped corners still give a positive rect', () => {
    const src = { x: 0, y: 0, w: 1440, h: 864 };
    const lb = planLetterbox(1440, 864, 1024);
    const r = rectFromNormalised([800, 900, 400, 100], src, lb);
    expect(r.w).toBeGreaterThan(0);
    expect(r.h).toBeGreaterThan(0);
  });
});

describe('contextRect', () => {
  const bounds = { w: 1440, h: 1000 };
  it('gives a small button some margin and a moderate aspect ratio', () => {
    const r = contextRect({ x: 600, y: 500, w: 220, h: 56 }, bounds);
    expect(r.x).toBeLessThan(600);
    expect(r.x + r.w).toBeGreaterThan(820);
    expect(r.y).toBeLessThan(500);
    expect(r.y + r.h).toBeGreaterThan(556);
    expect(r.w / r.h).toBeLessThanOrEqual(3.01);
    expect(r.w / r.h).toBeGreaterThanOrEqual(1 / 3.01);
  });

  it('gives a thin divider enough height to be seen', () => {
    const r = contextRect({ x: 100, y: 300, w: 800, h: 2 }, bounds);
    expect(r.h).toBeGreaterThan(100);
    expect(r.w / r.h).toBeLessThanOrEqual(3.01);
  });

  it('gives a tall thin region enough width', () => {
    const r = contextRect({ x: 300, y: 100, w: 3, h: 600 }, bounds);
    expect(r.w).toBeGreaterThan(100);
    expect(r.h / r.w).toBeLessThanOrEqual(3.01);
  });

  it('clamps to the image at every edge and keeps the original inside', () => {
    for (const orig of [
      { x: 0, y: 0, w: 220, h: 56 },
      { x: 1220, y: 944, w: 220, h: 56 },
      { x: 0, y: 990, w: 1440, h: 10 },
    ]) {
      const r = contextRect(orig, bounds);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(bounds.w);
      expect(r.y + r.h).toBeLessThanOrEqual(bounds.h);
      expect(r.x).toBeLessThanOrEqual(orig.x);
      expect(r.y).toBeLessThanOrEqual(orig.y);
      expect(r.x + r.w).toBeGreaterThanOrEqual(orig.x + orig.w);
      expect(r.y + r.h).toBeGreaterThanOrEqual(orig.y + orig.h);
    }
  });

  it('a region that is already the whole image stays the whole image', () => {
    expect(contextRect({ x: 0, y: 0, w: 1440, h: 1000 }, bounds)).toEqual({ x: 0, y: 0, w: 1440, h: 1000 });
  });

  it('is integer-valued', () => {
    const r = contextRect({ x: 33.3, y: 41.7, w: 120.4, h: 30.2 }, bounds);
    for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
  });
});

describe('planPairLayout', () => {
  it('keeps design left and implementation right while the pair is not very wide', () => {
    expect(planPairLayout({ w: 300, h: 400 }, { w: 300, h: 400 })).toBe('side');
  });
  it('stacks them (design on top) when side by side would be wider than 2:1', () => {
    expect(planPairLayout({ w: 252, h: 101 }, { w: 252, h: 101 })).toBe('stack');
    expect(planPairLayout({ w: 1000, h: 100 }, { w: 1000, h: 100 })).toBe('stack');
  });
  it('a very tall pair stays side by side', () => {
    expect(planPairLayout({ w: 100, h: 900 }, { w: 100, h: 900 })).toBe('side');
  });
});
