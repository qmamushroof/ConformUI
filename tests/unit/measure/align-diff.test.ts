import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DomSnapshot, Rect, RgbaImage } from '@kernel';
import { colourMeasurement, gapBetween, geometryMeasurement, measureApi, presenceMissing } from '@measure';
import { describe, expect, it } from 'vitest';
import { createNodeImageCodec, solidImage } from '../../helpers/node-codec';
import { domSnapshot, thresholds } from '../../helpers/samples';

const t = thresholds();
const codec = createNodeImageCodec();
const fixtureDir = resolve(__dirname, '../../fixtures/images');
const sampleDir = resolve(__dirname, '../../../src/features/demo/sample');
const png = (dir: string, name: string) =>
  codec.pixels(new Blob([readFileSync(resolve(dir, name))], { type: 'image/png' }));

type Rgb = [number, number, number];
function paint(img: RgbaImage, r: Rect, rgb: Rgb) {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) img.data.set([...rgb, 255], (y * img.width + x) * 4);
  }
}
const canvas = (w: number, h: number, bg: Rgb = [255, 255, 255]) => solidImage(w, h, [...bg, 255]);
const labOf = (rgb: Rgb) => measureApi.dominantColour(canvas(4, 4, rgb), { x: 0, y: 0, w: 4, h: 4 }, 'background');

// The committed design capture is 2x; halve it (2x2 box average) to CSS scale.
async function designAtCss(): Promise<RgbaImage> {
  const src = await png(sampleDir, 'design-desktop.png');
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

const meta = (cssWidth: number, height = 900) => ({ width: cssWidth, height, cssWidth });

describe('SPEC-MEAS-05 align', () => {
  it('SPEC-MEAS-05 equal widths are ok with no issues', () => {
    expect(measureApi.align(meta(1440), meta(1440), t)).toEqual({
      ok: true,
      widthDeltaPct: 0,
      heightDesign: 900,
      heightCapture: 900,
      issues: [],
    });
  });

  it('SPEC-MEAS-05 a width delta exactly at width_mismatch_pct is still ok', () => {
    const a = measureApi.align(meta(1000), meta(1020), t);
    expect(a.ok).toBe(true);
    expect(a.widthDeltaPct).toBe(2);
  });

  it('SPEC-MEAS-05 a width delta above width_mismatch_pct reports width-mismatch in both directions', () => {
    for (const w of [1021, 979]) {
      const a = measureApi.align(meta(1000), meta(w), t);
      expect(a.ok).toBe(false);
      expect(a.issues).toContain('width-mismatch');
    }
  });

  it('SPEC-MEAS-05 height differences are reported but never fail alignment', () => {
    const a = measureApi.align(meta(1440, 1077), meta(1440, 1045), t);
    expect(a.ok).toBe(true);
    expect(a.issues).toEqual(['height-differs']);
    expect([a.heightDesign, a.heightCapture]).toEqual([1077, 1045]);
  });

  it('SPEC-MEAS-05 uses the DOM viewport width for the capture when a snapshot exists', () => {
    const dom: DomSnapshot = { ...domSnapshot(), viewport: { width: 1440, height: 900 } };
    expect(measureApi.align(meta(1440), { ...meta(1000), dom }, t).issues).toEqual([]);
  });

  it('SPEC-MEAS-05 a zero design width is a mismatch, not NaN', () => {
    const a = measureApi.align(meta(0), meta(100), t);
    expect(a.ok).toBe(false);
    expect(Number.isFinite(a.widthDeltaPct)).toBe(true);
  });
});

describe('SPEC-MEAS-09 regionDiff', () => {
  const full = (img: RgbaImage): Rect => ({ x: 0, y: 0, w: img.width, h: img.height });

  it('SPEC-MEAS-09 identical images give ratio 0 and an empty mask', async () => {
    const a = await png(fixtureDir, 'aa-only-a.png');
    const r = measureApi.regionDiff(a, full(a), a, full(a), t);
    expect(r.diffRatio).toBe(0);
    expect(r.diffMask.length).toBe(a.width * a.height * 4);
    expect(r.diffMask.every((v) => v === 0)).toBe(true);
  });

  it('SPEC-MEAS-09 anti-aliasing-only differences stay below 0.01', async () => {
    const a = await png(fixtureDir, 'aa-only-a.png');
    const b = await png(fixtureDir, 'aa-only-b.png');
    expect(measureApi.regionDiff(a, full(a), b, full(b), t).diffRatio).toBeLessThan(0.01);
  });

  it('SPEC-MEAS-09 a missing element produces a large ratio and a magenta mask', async () => {
    const withEl = await png(fixtureDir, 'missing-element-with.png');
    const without = await png(fixtureDir, 'missing-element-without.png');
    const r = measureApi.regionDiff(withEl, full(withEl), without, full(without), t);
    expect(r.diffRatio).toBeCloseTo((60 * 30) / (200 * 120), 5);
    const i = (50 * 200 + 60) * 4;
    expect([...r.diffMask.slice(i, i + 4)]).toEqual([255, 0, 255, 255]);
  });

  it('SPEC-MEAS-09 differently sized rects are cropped to the smaller width and height', () => {
    const a = canvas(50, 50);
    const b = canvas(40, 30);
    paint(b, { x: 0, y: 0, w: 40, h: 30 }, [0, 0, 0]);
    const r = measureApi.regionDiff(a, { x: 0, y: 0, w: 50, h: 50 }, b, { x: 0, y: 0, w: 40, h: 30 }, t);
    expect(r.diffRatio).toBe(1);
    expect(r.diffMask.length).toBe(40 * 30 * 4);
  });

  it('SPEC-MEAS-09 an empty or off-image rect yields ratio 0 and an empty mask', () => {
    const a = canvas(10, 10);
    const r = measureApi.regionDiff(a, { x: 50, y: 50, w: 5, h: 5 }, a, { x: 0, y: 0, w: 0, h: 0 }, t);
    expect(r).toEqual({ diffRatio: 0, diffMask: new Uint8ClampedArray(0) });
  });

  it('SPEC-MEAS-09 is deterministic', async () => {
    const a = await png(fixtureDir, 'missing-element-with.png');
    const b = await png(fixtureDir, 'missing-element-without.png');
    const run = () => measureApi.regionDiff(a, full(a), b, full(b), t);
    expect(run()).toEqual(run());
  });
});

describe('SPEC-MEAS-10 presence', () => {
  const region: Rect = { x: 40, y: 40, w: 60, h: 30 };

  it('SPEC-MEAS-10 inkRatio is the fraction of ink pixels against the region background', () => {
    const img = canvas(200, 120);
    paint(img, { x: 40, y: 40, w: 30, h: 30 }, [30, 90, 200]);
    expect(measureApi.inkRatio(img, region)).toBeCloseTo(0.5, 5);
    expect(measureApi.inkRatio(canvas(50, 50), { x: 5, y: 5, w: 20, h: 20 })).toBe(0);
    expect(measureApi.inkRatio(canvas(50, 50), { x: 80, y: 80, w: 20, h: 20 })).toBe(0);
  });

  it('SPEC-MEAS-10 fixture: element present in design and absent in capture is missing', async () => {
    const withEl = await png(fixtureDir, 'missing-element-with.png');
    const without = await png(fixtureDir, 'missing-element-without.png');
    expect(presenceMissing(withEl, region, without, region, 1, t)).toBe(true);
  });

  it('SPEC-MEAS-10 fixture: element present in both is not missing', async () => {
    const withEl = await png(fixtureDir, 'missing-element-with.png');
    expect(presenceMissing(withEl, region, withEl, region, 1, t)).toBe(false);
  });

  it('SPEC-MEAS-10 partial occlusion above presence_ink_ratio keeps it present', () => {
    const design = canvas(200, 120);
    paint(design, region, [30, 90, 200]);
    const capture = canvas(200, 120);
    paint(capture, { x: 40, y: 40, w: 60, h: 3 }, [30, 90, 200]);
    expect(presenceMissing(design, region, capture, region, 1, t)).toBe(false);
  });

  it('SPEC-MEAS-10 capture ink just above and below presence_ink_ratio', () => {
    const design = canvas(200, 120);
    paint(design, region, [30, 90, 200]);
    const above = canvas(200, 120);
    paint(above, { x: 40, y: 40, w: 60, h: 1 }, [30, 90, 200]); // 3.33 %
    expect(presenceMissing(design, region, above, region, 1, t)).toBe(false);
    const below = canvas(200, 120);
    paint(below, { x: 40, y: 40, w: 30, h: 1 }, [30, 90, 200]); // 1.67 %
    expect(presenceMissing(design, region, below, region, 1, t)).toBe(true);
  });

  it('SPEC-MEAS-10 a design region with too little ink is never reported missing', () => {
    const design = canvas(200, 120);
    paint(design, { x: 40, y: 40, w: 60, h: 1 }, [30, 90, 200]); // 3.3 % < 3 x 0.03
    expect(presenceMissing(design, region, canvas(200, 120), region, 1, t)).toBe(false);
  });

  it('SPEC-MEAS-10 a low location score falls back to the same rect', () => {
    const design = canvas(200, 120);
    paint(design, region, [30, 90, 200]);
    const capture = canvas(200, 120);
    const located: Rect = { x: 100, y: 80, w: 60, h: 30 };
    paint(capture, located, [30, 90, 200]);
    expect(presenceMissing(design, region, capture, located, 0.9, t)).toBe(false);
    expect(presenceMissing(design, region, capture, located, 0.4, t)).toBe(true);
  });
});

describe('SPEC-MEAS-11 colour', () => {
  it('SPEC-MEAS-11 deltaE is the Euclidean OKLab distance', () => {
    const a = { L: 0.5, a: 0.1, b: -0.1 };
    expect(measureApi.deltaE(a, a)).toBe(0);
    expect(measureApi.deltaE(a, { L: 0.8, a: 0.5, b: -0.1 })).toBeCloseTo(0.5, 10);
  });

  it('SPEC-MEAS-11 dominantColour background returns the region fill', () => {
    const img = canvas(100, 60);
    paint(img, { x: 20, y: 10, w: 60, h: 30 }, [47, 91, 232]);
    const bg = measureApi.dominantColour(img, { x: 20, y: 10, w: 60, h: 30 }, 'background');
    expect(measureApi.deltaE(bg, labOf([47, 91, 232]))).toBeLessThan(1e-6);
  });

  it('SPEC-MEAS-11 dominantColour text returns the median ink colour on a fill', () => {
    const img = canvas(100, 60, [47, 91, 232]);
    paint(img, { x: 30, y: 25, w: 40, h: 6 }, [255, 255, 255]);
    const text = measureApi.dominantColour(img, { x: 20, y: 10, w: 60, h: 30 }, 'text');
    expect(measureApi.deltaE(text, labOf([255, 255, 255]))).toBeLessThan(1e-6);
  });

  it('SPEC-MEAS-11 text colour on a region with no ink falls back to the background colour', () => {
    const img = canvas(40, 40, [10, 20, 30]);
    const r = { x: 5, y: 5, w: 20, h: 20 };
    expect(measureApi.dominantColour(img, r, 'text')).toEqual(measureApi.dominantColour(img, r, 'background'));
  });

  it('SPEC-MEAS-11 colour delta at, below and above colour_delta_e', () => {
    const base = labOf([47, 91, 232]);
    const at = colourMeasurement('CTA colour', base, { ...base, L: base.L + 0.08 }, t);
    const below = colourMeasurement('CTA colour', base, { ...base, L: base.L + 0.0799 }, t);
    const above = colourMeasurement('CTA colour', base, { ...base, L: base.L + 0.0801 }, t);
    expect([at.pass, below.pass, above.pass]).toEqual([true, true, false]);
    expect(above.measurement).toMatchObject({
      name: 'CTA colour',
      unit: 'deltaE',
      source: { design: 'design-image', observed: 'dom-snapshot' },
    });
  });

  it('SPEC-MEAS-11 sample: design CTA matches the fixed DOM colour and is below 0.08 from the flawed one', async () => {
    const design = await designAtCss();
    const d = measureApi.dominantColour(design, { x: 120, y: 393, w: 220, h: 52 }, 'background');
    const dFixed = measureApi.deltaE(d, labOf([47, 91, 232]));
    const dFlawed = measureApi.deltaE(d, labOf([61, 99, 220]));
    expect(dFixed).toBeLessThan(0.01);
    expect(dFlawed).toBeGreaterThan(dFixed);
    expect(dFlawed).toBeLessThan(0.08);
  });
});

describe('SPEC-MEAS-12 geometry and pct', () => {
  it('SPEC-MEAS-12 pct is signed, rounded to 1 decimal, and safe for a zero design', () => {
    expect(measureApi.pct(220, 132)).toBe(-40);
    expect(measureApi.pct(300, 301)).toBe(0.3);
    expect(measureApi.pct(3, 4)).toBe(33.3);
    expect(Object.is(measureApi.pct(100, 100), 0)).toBe(true);
    expect(measureApi.pct(0, 0)).toBe(0);
    expect(measureApi.pct(0, 5)).toBe(100);
    expect(measureApi.pct(0, -5)).toBe(-100);
  });

  it('SPEC-MEAS-12 size within size_tolerance_pct passes, beyond fails (boundary 8 %)', () => {
    const pass = (o: number) => geometryMeasurement('size', 'CTA width', 100, o, 'dom-snapshot', t).pass;
    expect([pass(108), pass(109), pass(92), pass(91)]).toEqual([true, false, true, false]);
  });

  it('SPEC-MEAS-12 gap uses spacing_tolerance_pct (15 %)', () => {
    expect(geometryMeasurement('gap', 'Gap', 100, 115, 'dom-snapshot', t).pass).toBe(true);
    expect(geometryMeasurement('gap', 'Gap', 100, 116, 'dom-snapshot', t).pass).toBe(false);
  });

  it('SPEC-MEAS-12 displayed px values are integers and carry both source tags', () => {
    const r = geometryMeasurement('size', 'CTA width', 219.6, 131.7, 'capture-image', t);
    expect(r.measurement).toEqual({
      name: 'CTA width',
      design: 220,
      observed: 132,
      unit: 'px',
      delta: -88,
      deltaPct: -40,
      source: { design: 'design-image', observed: 'capture-image' },
    });
    expect(r.pass).toBe(false);
  });

  it('SPEC-MEAS-12 gapBetween measures vertical and horizontal gaps from boxes', () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 50 };
    expect(gapBetween(a, { x: 0, y: 114, w: 100, h: 10 }, 'y')).toBe(64);
    expect(gapBetween(a, { x: 130, y: 0, w: 10, h: 10 }, 'x')).toBe(30);
    expect(gapBetween(a, { x: 0, y: 40, w: 10, h: 10 }, 'y')).toBe(0);
  });
});

describe('SPEC-MEAS-16 determinism', () => {
  it('SPEC-MEAS-16 repeated calls deep-equal', async () => {
    const d = await designAtCss();
    const r: Rect = { x: 120, y: 393, w: 220, h: 52 };
    const run = () => ({
      c: measureApi.dominantColour(d, r, 'text'),
      i: measureApi.inkRatio(d, r),
      g: geometryMeasurement('size', 'w', 220, 132, 'dom-snapshot', t),
    });
    expect(run()).toEqual(run());
  });
});

describe('sample acceptance (SPEC §4.4.7)', () => {
  const heroArt: Rect = { x: 800, y: 136, w: 520, h: 400 };

  it('SPEC-MEAS-10 sample defect 1 (hero art) is missing on flawed and present on fixed', async () => {
    const design = await designAtCss();
    const flawed = await png(sampleDir, 'flawed-desktop.png');
    const fixed = await png(sampleDir, 'fixed-desktop.png');
    expect(presenceMissing(design, heroArt, flawed, heroArt, 1, t)).toBe(true);
    expect(presenceMissing(design, heroArt, fixed, heroArt, 1, t)).toBe(false);
  });

  it('SPEC-MEAS-05 sample captures align with the design width and differ in height', async () => {
    const design = await designAtCss();
    const flawed = await png(sampleDir, 'flawed-desktop.png');
    const a = measureApi.align(
      { width: design.width, height: design.height, cssWidth: 1440 },
      { width: flawed.width, height: flawed.height, cssWidth: 1440 },
      t,
    );
    expect(a.ok).toBe(true);
    expect(a.issues).toEqual(['height-differs']);
  });

  it('SPEC-MEAS-09 sample: CTA region differs more on flawed than on fixed', async () => {
    const design = await designAtCss();
    const flawed = await png(sampleDir, 'flawed-desktop.png');
    const fixed = await png(sampleDir, 'fixed-desktop.png');
    const dr: Rect = { x: 120, y: 393, w: 220, h: 52 };
    const fx = measureApi.regionDiff(design, dr, fixed, { x: 120, y: 393, w: 220, h: 52 }, t).diffRatio;
    const fl = measureApi.regionDiff(design, dr, flawed, { x: 120, y: 417, w: 132, h: 52 }, t).diffRatio;
    expect(fl).toBeGreaterThan(fx);
    expect(fx).toBeLessThan(0.2);
  });

  it('SPEC-MEAS-12 sample planted geometry defects exceed tolerance; matching values pass', () => {
    const pass = (k: 'size' | 'gap', d: number, o: number) => geometryMeasurement(k, 'x', d, o, 'dom-snapshot', t).pass;
    expect(pass('size', 220, 132)).toBe(false);
    expect(pass('size', 56, 28)).toBe(false);
    expect(pass('gap', 96, 64)).toBe(false);
    expect(pass('size', 220, 220)).toBe(true);
  });
});
