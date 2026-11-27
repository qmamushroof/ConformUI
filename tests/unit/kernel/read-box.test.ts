import { planLetterbox, type Rect, readBox, rectToNormalised } from '@kernel';
import { describe, expect, it } from 'vitest';

// readBox: a model box in whatever scale it answered, to a CSS rect in the source, or undefined when it is junk.

const band: Rect = { x: 0, y: 864, w: 1440, h: 864 };
const lb = planLetterbox(band.w, band.h, 1024); // side 1024, dy 205
const target: Rect = { x: 600, y: 1200, w: 220, h: 56 };

describe('readBox', () => {
  it('reads a normal 0..1000 box through the padding (canvas reading)', () => {
    const r = readBox(rectToNormalised(target, band, lb), band, lb, lb.side);
    expect(r?.reading).toBe('canvas');
    expect(r?.scale).toBe('normalised');
    expect(r?.rect.x).toBeCloseTo(target.x, 0);
    expect(r?.rect.y).toBeCloseTo(target.y, 0);
  });

  it('reads 0..1 floats as fractions of the canvas', () => {
    const n = rectToNormalised(target, band, lb);
    const r = readBox(n.map((v) => v / 1000) as [number, number, number, number], band, lb, lb.side);
    expect(r?.scale).toBe('unit');
    expect(r?.rect.x).toBeCloseTo(target.x, 0);
    expect(r?.rect.h).toBeCloseTo(target.h, 0);
  });

  it('reads values above 1000 as pixels of the canvas that was sent', () => {
    const px = rectToNormalised(target, band, lb).map((v) => (v / 1000) * lb.side) as [number, number, number, number];
    const wide: [number, number, number, number] = [px[0], px[1], px[2], 1010]; // right edge beyond 1000, within 1024
    const r = readBox(wide, band, lb, lb.side);
    expect(r?.scale).toBe('pixels');
    expect(r?.rect.x).toBeCloseTo(target.x, -1);
  });

  it('rejects pixel values that do not fit the canvas, and pixels when the canvas size is unknown', () => {
    expect(readBox([0, 0, 3000, 3000], band, lb, lb.side)).toBeUndefined();
    expect(readBox([0, 0, 1500, 1500], band, lb)).toBeUndefined();
  });

  it('rejects negative, NaN and infinite values', () => {
    expect(readBox([-5, 10, 100, 100], band, lb, lb.side)).toBeUndefined();
    expect(readBox([Number.NaN, 10, 100, 100], band, lb, lb.side)).toBeUndefined();
    expect(readBox([0, 10, Number.POSITIVE_INFINITY, 100], band, lb, lb.side)).toBeUndefined();
  });

  it('rejects zero-area and sliver boxes', () => {
    expect(readBox([500, 500, 500, 500], band, lb, lb.side)).toBeUndefined();
    expect(readBox([500, 100, 501, 900], band, lb, lb.side)).toBeUndefined();
    expect(readBox([500, 100, 600, 101], band, lb, lb.side)).toBeUndefined();
  });

  it('swapped corners are put in order', () => {
    const r = readBox([600, 600, 400, 300], band, lb, lb.side);
    expect(r?.rect.w).toBeGreaterThan(1);
    expect(r?.rect.h).toBeGreaterThan(1);
  });

  it('a box that lies in the padding is read against the content instead (content reading)', () => {
    // top 20% of the canvas is padding; [20,100,100,500] is entirely inside it
    const r = readBox([20, 100, 100, 500], band, lb, lb.side);
    expect(r?.reading).toBe('content');
    expect(r?.rect.y).toBeCloseTo(band.y + 0.02 * band.h, 0);
    expect(r?.rect.h).toBeCloseTo(0.08 * band.h, 0);
  });

  it('a box half on content stays a canvas reading', () => {
    const r = readBox([150, 100, 300, 500], band, lb, lb.side);
    expect(r?.reading).toBe('canvas');
  });

  it('an unpadded image (cloud) has only the canvas reading and never needs pixels', () => {
    const id = { side: 1000, dx: 0, dy: 0, w: 1000, h: 1000 };
    const r = readBox([100, 100, 200, 300], band, id);
    expect(r?.reading).toBe('canvas');
    expect(readBox([100, 100, 1200, 300], band, id)).toBeUndefined();
  });
});
