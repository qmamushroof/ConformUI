import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CuiError, MAX_SOURCE_SIDE } from '@kernel';
import { describe, expect, it } from 'vitest';
import { fixtureBuilders } from '../../fixtures/images/generate';
import { createNodeImageCodec, pngBlob, solidImage } from '../../helpers/node-codec';

const sampleDir = resolve(__dirname, '../../../src/features/demo/sample');
const fixtureDir = resolve(__dirname, '../../fixtures/images');
const sample = (name: string) => new Blob([readFileSync(resolve(sampleDir, name))], { type: 'image/png' });
const fixture = (name: string, type = 'image/png') => new Blob([readFileSync(resolve(fixtureDir, name))], { type });
const codec = createNodeImageCodec();
const px = (img: { width: number; data: Uint8ClampedArray }, x: number, y: number) => {
  const i = (y * img.width + x) * 4;
  return [...img.data.subarray(i, i + 4)];
};
const code = async (p: Promise<unknown>) => {
  const e = await p.then(
    () => undefined,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(CuiError);
  return (e as CuiError).code;
};

describe('8.1 node codec: pixels', () => {
  it('8.1-pixels decodes committed sample PNGs to the expected size', async () => {
    const cases: [string, number, number][] = [
      ['flawed-desktop.png', 1440, 1045],
      ['fixed-mobile.png', 390, 1723],
      ['design-desktop.png', 2880, 2154],
    ];
    for (const [name, w, h] of cases) {
      const img = await codec.pixels(sample(name));
      expect([img.width, img.height]).toEqual([w, h]);
      expect(img.data).toBeInstanceOf(Uint8ClampedArray);
      expect(img.data.length).toBe(w * h * 4);
    }
  });

  it('8.1-pixels exposes RGBA at (x,y) with row-major layout', async () => {
    const src = solidImage(3, 2, [10, 20, 30, 255]);
    src.data.set([1, 2, 3, 128], (1 * 3 + 2) * 4);
    const img = await codec.pixels(pngBlob(src));
    expect(px(img, 0, 0)).toEqual([10, 20, 30, 255]);
    expect(px(img, 2, 1)).toEqual([1, 2, 3, 128]);
  });

  it('8.1-pixels rejects bytes that are not a PNG with IMAGE_DECODE_FAILED', async () => {
    const bad = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    expect(await code(codec.pixels(bad))).toBe('IMAGE_DECODE_FAILED');
  });

  it('8.1-pixels rejects the WebP fixture (not decodable in Node)', async () => {
    expect(await code(codec.pixels(fixture('sample.webp', 'image/webp')))).toBe('IMAGE_DECODE_FAILED');
  });
});

describe('8.1 node codec: normalise and probe', () => {
  it('8.1-normalise passes an already-normalised PNG through with its ref', async () => {
    const blob = sample('flawed-mobile.png');
    const out = await codec.normalise(blob, 390);
    expect(out.ref).toEqual({ mime: 'image/png', width: 390, height: 1365, cssWidth: 390, bytes: blob.size });
    expect((await codec.pixels(out.blob)).width).toBe(390);
  });

  it('8.1-normalise rejects a width that differs from cssWidth', async () => {
    expect(await code(codec.normalise(sample('design-desktop.png'), 1440))).toBe('IMAGE_DECODE_FAILED');
  });

  it('8.1-normalise rejects invalid target width and unsupported mime; probe rejects huge files', async () => {
    expect(await code(codec.normalise(sample('fixed-mobile.png'), 0))).toBe('IMAGE_DECODE_FAILED');
    expect(await code(codec.normalise(sample('fixed-mobile.png'), Number.NaN))).toBe('IMAGE_DECODE_FAILED');
    expect(await code(codec.normalise(new Blob(['x'], { type: 'image/gif' }), 10))).toBe('IMAGE_UNSUPPORTED');
    const huge = { type: 'image/png', size: 21 * 1024 * 1024 } as Blob;
    expect(await code(codec.probe(huge))).toBe('IMAGE_TOO_LARGE');
  });

  it('8.1-normalise rejects the oversized and tall-page fixtures with IMAGE_TOO_LARGE', async () => {
    expect(await code(codec.normalise(fixture('oversized.png'), 8193))).toBe('IMAGE_TOO_LARGE');
    expect(await code(codec.normalise(fixture('tall-page.png'), 390))).toBe('IMAGE_TOO_LARGE');
  });

  it('8.1-probe returns source size and mime without resampling', async () => {
    expect(await codec.probe(sample('design-desktop.png'))).toEqual({ width: 2880, height: 2154, mime: 'image/png' });
    expect(await code(codec.probe(fixture('oversized.png')))).toBe('IMAGE_TOO_LARGE');
    expect(MAX_SOURCE_SIDE).toBeLessThan(8193);
  });
});

describe('8.1 node codec: crop', () => {
  const grid = () => {
    const img = solidImage(10, 10, [0, 0, 0, 255]);
    img.data.set([255, 0, 0, 255], (3 * 10 + 4) * 4);
    return pngBlob(img);
  };

  it('8.1-crop extracts the rect as PNG with a matching base64 and byte count', async () => {
    const out = await codec.crop(grid(), { x: 4, y: 3, w: 2, h: 2 }, 100, 'image/png');
    expect(out.mime).toBe('image/png');
    expect(out.role).toBe('design');
    expect(out.bytes).toBe(out.blob.size);
    expect(Buffer.from(out.base64, 'base64').length).toBe(out.bytes);
    const img = await codec.pixels(out.blob);
    expect([img.width, img.height]).toEqual([2, 2]);
    expect(px(img, 0, 0)).toEqual([255, 0, 0, 255]);
  });

  it('8.1-crop clamps a rect that overhangs the image', async () => {
    const out = await codec.crop(grid(), { x: -3, y: 8, w: 6, h: 10 }, 100, 'image/png');
    const img = await codec.pixels(out.blob);
    expect([img.width, img.height]).toEqual([3, 2]);
  });

  it('8.1-crop rejects a rect fully outside the image', async () => {
    expect(await code(codec.crop(grid(), { x: 20, y: 20, w: 5, h: 5 }, 100, 'image/png'))).toBe('IMAGE_DECODE_FAILED');
  });

  it('8.1-crop scales down so the longest side is at most maxSide', async () => {
    const out = await codec.crop(grid(), { x: 0, y: 0, w: 10, h: 5 }, 5, 'image/png');
    const img = await codec.pixels(out.blob);
    expect([img.width, img.height]).toEqual([5, 3]);
  });

  it('8.1-crop refuses JPEG output (no encoder in Node)', async () => {
    expect(await code(codec.crop(grid(), { x: 0, y: 0, w: 2, h: 2 }, 100, 'image/jpeg'))).toBe('IMAGE_UNSUPPORTED');
  });
});

describe('8.1 node codec: composePair', () => {
  const red = pngBlob(solidImage(4, 3, [255, 0, 0, 255]));
  const blue = pngBlob(solidImage(2, 5, [0, 0, 255, 255]));
  const decodePair = async (b64: string) => codec.pixels(new Blob([Buffer.from(b64, 'base64')], { type: 'image/png' }));

  it('8.1-pair puts design left, an 8 px white gap, capture right, height = max', async () => {
    const out = await codec.composePair(red, { x: 0, y: 0, w: 4, h: 3 }, blue, { x: 0, y: 0, w: 2, h: 5 }, 100);
    expect(out.role).toBe('pair');
    expect(out.mime).toBe('image/png');
    expect(out.bytes).toBe(Buffer.from(out.base64, 'base64').length);
    const img = await decodePair(out.base64);
    expect([img.width, img.height]).toEqual([4 + 8 + 2, 5]);
    expect(px(img, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(px(img, 5, 0)).toEqual([255, 255, 255, 255]);
    expect(px(img, 12, 0)).toEqual([0, 0, 255, 255]);
    expect(px(img, 0, 4)).toEqual([255, 255, 255, 255]);
  });

  it('8.1-pair clamps rects and rejects an outside rect', async () => {
    const out = await codec.composePair(red, { x: 2, y: 0, w: 99, h: 99 }, blue, { x: 0, y: 0, w: 2, h: 5 }, 100);
    expect((await decodePair(out.base64)).width).toBe(2 + 8 + 2);
    const outside = codec.composePair(red, { x: 50, y: 50, w: 4, h: 4 }, blue, { x: 0, y: 0, w: 2, h: 5 }, 100);
    expect(await code(outside)).toBe('IMAGE_DECODE_FAILED');
  });

  it('8.1-pair scales so the longest side is at most maxSide', async () => {
    const out = await codec.composePair(red, { x: 0, y: 0, w: 4, h: 3 }, blue, { x: 0, y: 0, w: 2, h: 5 }, 7);
    const img = await decodePair(out.base64);
    expect(Math.max(img.width, img.height)).toBeLessThanOrEqual(7);
  });
});

describe('8.1 image fixtures', () => {
  it('8.1-fixtures committed files equal the deterministic builders', () => {
    for (const [name, build] of Object.entries(fixtureBuilders)) {
      expect(Buffer.compare(readFileSync(resolve(fixtureDir, name)), Buffer.from(build())), name).toBe(0);
    }
    expect(Object.keys(fixtureBuilders).sort()).toEqual([
      'aa-only-a.png',
      'aa-only-b.png',
      'missing-element-with.png',
      'missing-element-without.png',
      'oversized.png',
      'sample.webp',
      'tall-page.png',
    ]);
  });

  it('8.1-fixtures AA-only pair differs only slightly at edges; missing-element pair differs in a solid block', async () => {
    const a = await codec.pixels(fixture('aa-only-a.png'));
    const b = await codec.pixels(fixture('aa-only-b.png'));
    expect([a.width, a.height]).toEqual([b.width, b.height]);
    let changed = 0;
    let maxDelta = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      let d = 0;
      for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs((a.data[i + c] ?? 0) - (b.data[i + c] ?? 0)));
      if (d > 0) changed++;
      maxDelta = Math.max(maxDelta, d);
    }
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThan((a.width * a.height) / 20);
    expect(maxDelta).toBeLessThanOrEqual(40);

    const w = await codec.pixels(fixture('missing-element-with.png'));
    const o = await codec.pixels(fixture('missing-element-without.png'));
    expect(px(w, 50, 50)).not.toEqual(px(o, 50, 50));
    expect(px(w, 5, 5)).toEqual(px(o, 5, 5));
  });

  it('8.1-fixtures tall page exceeds the CSS height limit and oversized exceeds the side limit', async () => {
    const tall = pngSize(fixture('tall-page.png'));
    expect((await tall).height).toBeGreaterThan(16_000);
    expect((await tall).width).toBe(390);
    expect(await code(codec.probe(fixture('oversized.png')))).toBe('IMAGE_TOO_LARGE');
  });
});

async function pngSize(b: Blob) {
  const img = await codec.pixels(b);
  return { width: img.width, height: img.height };
}
