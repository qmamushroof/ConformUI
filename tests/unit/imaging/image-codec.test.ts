import { CuiError, MAX_CSS_HEIGHT, MAX_INPUT_BYTES, MAX_SOURCE_SIDE } from '@kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImageCodec } from '../../../src/platform/imaging';

// Browser image APIs are stubbed: a source "image" is a Blob whose text is JSON {w,h}.

interface FakeCanvas {
  width: number;
  height: number;
  draws: unknown[][];
  fills: unknown[][];
  smoothing?: string;
  encoded?: { type: string; quality?: number };
}

let canvases: FakeCanvas[];
let bitmaps: { width: number; height: number; closed: boolean }[];
let bitmapOptions: unknown[];

const img = (w: number, h: number, type = 'image/png') => new Blob([JSON.stringify({ w, h })], { type });
const full = (w: number, h: number) => ({ x: 0, y: 0, w, h });

beforeEach(() => {
  canvases = [];
  bitmaps = [];
  bitmapOptions = [];
  vi.stubGlobal('createImageBitmap', async (b: Blob, opts?: unknown) => {
    bitmapOptions.push(opts);
    let d: { w: number; h: number };
    try {
      d = JSON.parse((await b.text()).trim());
    } catch {
      throw new DOMException('bad image', 'InvalidStateError');
    }
    const bm = {
      width: d.w,
      height: d.h,
      closed: false,
      close() {
        bm.closed = true;
      },
    };
    bitmaps.push(bm);
    return bm;
  });
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      c: FakeCanvas;
      constructor(w: number, h: number) {
        this.c = { width: w, height: h, draws: [], fills: [] };
        canvases.push(this.c);
      }
      getContext() {
        const c = this.c;
        return {
          set imageSmoothingQuality(v: string) {
            c.smoothing = v;
          },
          set fillStyle(_v: string) {},
          fillRect: (...a: unknown[]) => c.fills.push(a),
          drawImage: (...a: unknown[]) => c.draws.push(a),
          getImageData: (_x: number, _y: number, w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4).fill(7),
          }),
        };
      }
      async convertToBlob(o: { type: string; quality?: number }) {
        this.c.encoded = o;
        return new Blob([`${o.type}:${this.c.width}x${this.c.height}`], { type: o.type });
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const cv = (i: number): FakeCanvas => canvases[i] as FakeCanvas;
const bm0 = () => bitmaps[0] as { closed: boolean };
const codec = () => createImageCodec();
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(CuiError);
    return (e as CuiError).code;
  }
  return 'none';
};

describe('SPEC-MEAS-01 accepted input and limits', () => {
  it('SPEC-MEAS-01: rejects non png/jpeg/webp MIME with IMAGE_UNSUPPORTED before decoding', async () => {
    expect(await code(codec().normalise(img(10, 10, 'image/gif'), 10))).toBe('IMAGE_UNSUPPORTED');
    expect(await code(codec().normalise(img(10, 10, ''), 10))).toBe('IMAGE_UNSUPPORTED');
    expect(bitmaps).toHaveLength(0);
  });
  it('SPEC-MEAS-01: accepts png, jpeg and webp', async () => {
    for (const t of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(await code(codec().normalise(img(10, 10, t), 10))).toBe('none');
    }
  });
  it('SPEC-MEAS-01: file over 20 MiB is IMAGE_TOO_LARGE naming the limit, exactly 20 MiB passes', async () => {
    const big = img(10, 10);
    Object.defineProperty(big, 'size', { value: MAX_INPUT_BYTES + 1 });
    const err = await codec()
      .normalise(big, 10)
      .catch((e) => e);
    expect(err.code).toBe('IMAGE_TOO_LARGE');
    expect(err.message).toMatch(/20 MiB/);
    const edge = img(10, 10);
    Object.defineProperty(edge, 'size', { value: MAX_INPUT_BYTES });
    expect(await code(codec().normalise(edge, 10))).toBe('none');
  });
  it('SPEC-MEAS-01: side over 8192 px is IMAGE_TOO_LARGE, 8192 passes', async () => {
    expect(await code(codec().normalise(img(MAX_SOURCE_SIDE + 1, 100), 100))).toBe('IMAGE_TOO_LARGE');
    expect(await code(codec().normalise(img(100, MAX_SOURCE_SIDE + 1), 100))).toBe('IMAGE_TOO_LARGE');
    expect(await code(codec().normalise(img(MAX_SOURCE_SIDE, 100), 100))).toBe('none');
  });
  it('SPEC-MEAS-01: decodes with imageOrientation from-image', async () => {
    await codec().normalise(img(10, 10), 10);
    expect(bitmapOptions[0]).toEqual({ imageOrientation: 'from-image' });
  });
  it('SPEC-MEAS-01: undecodable bytes map to IMAGE_DECODE_FAILED; bitmaps are closed on success', async () => {
    expect(await code(codec().normalise(new Blob(['garbage'], { type: 'image/png' }), 10))).toBe('IMAGE_DECODE_FAILED');
    await codec().normalise(img(10, 10), 10);
    expect(bitmaps.every((b) => b.closed)).toBe(true);
  });
  it('SPEC-MEAS-01: invalid cssWidth is rejected', async () => {
    for (const w of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(await code(codec().normalise(img(10, 10), w))).toBe('IMAGE_DECODE_FAILED');
    }
  });
});

describe('SPEC-MEAS-02 normalise', () => {
  it('SPEC-MEAS-02: resamples to cssWidth with proportional height, PNG, high smoothing', async () => {
    const { blob, ref } = await codec().normalise(img(2880, 8000), 1440);
    expect(ref).toEqual({ mime: 'image/png', width: 1440, height: 4000, cssWidth: 1440, bytes: blob.size });
    const c = cv(0);
    expect([c.width, c.height]).toEqual([1440, 4000]);
    expect(c.smoothing).toBe('high');
    expect(c.encoded).toEqual({ type: 'image/png' });
    expect(c.draws[0]?.slice(1)).toEqual([0, 0, 1440, 4000]);
  });
  it('SPEC-MEAS-02: upscales a narrower source and rounds the height', async () => {
    const { ref } = await codec().normalise(img(375, 1001), 390);
    expect(ref.height).toBe(Math.round((1001 * 390) / 375));
  });
  it('SPEC-MEAS-02: height of exactly 16 000 passes, 16 001 is IMAGE_TOO_LARGE and never cut', async () => {
    expect(await code(codec().normalise(img(1000, MAX_CSS_HEIGHT / 2), 2000))).toBe('none');
    expect(await code(codec().normalise(img(1000, MAX_CSS_HEIGHT / 2 + 1), 2000))).toBe('IMAGE_TOO_LARGE');
  });
  it('SPEC-MEAS-02: a very flat image never produces a zero height', async () => {
    const { ref } = await codec().normalise(img(8000, 1), 100);
    expect(ref.height).toBe(1);
  });
});

describe('SPEC-MEAS-03 pixels, crop, composePair', () => {
  it('SPEC-MEAS-03: pixels returns RGBA at bitmap size', async () => {
    const px = await codec().pixels(img(4, 3));
    expect([px.width, px.height, px.data.length]).toEqual([4, 3, 48]);
    expect(await code(codec().pixels(new Blob(['x'])))).toBe('IMAGE_DECODE_FAILED');
  });
  it('SPEC-MEAS-03, SPEC-AI-11: crop downscales to maxSide, JPEG q0.85, base64 without data prefix', async () => {
    const r = await codec().crop(img(1440, 4000), { x: 0, y: 100, w: 1440, h: 2048 }, 1024, 'image/jpeg');
    expect([cv(0).width, cv(0).height]).toEqual([720, 1024]);
    expect(cv(0).encoded).toEqual({ type: 'image/jpeg', quality: 0.85 });
    expect(cv(0).draws[0]?.slice(1)).toEqual([0, 100, 1440, 2048, 0, 0, 720, 1024]);
    expect(r.mime).toBe('image/jpeg');
    expect(r.base64.startsWith('data:')).toBe(false);
    expect(atob(r.base64)).toBe('image/jpeg:720x1024');
    expect(r.bytes).toBe(r.blob.size);
    expect(r.blob.type).toBe('image/jpeg');
  });
  it('SPEC-MEAS-03: JPEG is painted on white first; PNG has no quality and is not upscaled', async () => {
    await codec().crop(img(200, 100), full(200, 100), 1024, 'image/jpeg');
    expect(cv(0).fills).toHaveLength(1);
    await codec().crop(img(200, 100), { x: 10, y: 10, w: 50, h: 40 }, 1024, 'image/png');
    expect([cv(1).width, cv(1).height]).toEqual([50, 40]);
    expect(cv(1).encoded).toEqual({ type: 'image/png' });
  });
  it('SPEC-MEAS-03: crop clamps a rect exceeding the image and rejects an empty one', async () => {
    await codec().crop(img(100, 100), { x: 80, y: 90, w: 50, h: 50 }, 1024, 'image/png');
    expect([cv(0).width, cv(0).height]).toEqual([20, 10]);
    expect(await code(codec().crop(img(100, 100), { x: 100, y: 0, w: 10, h: 10 }, 1024, 'image/png'))).toBe(
      'IMAGE_DECODE_FAILED',
    );
    expect(await code(codec().crop(img(100, 100), { x: 0, y: 0, w: 0, h: 10 }, 1024, 'image/png'))).toBe(
      'IMAGE_DECODE_FAILED',
    );
  });
  it('SPEC-MEAS-03: composePair puts design left, capture right, 8 px gap, white canvas, role pair', async () => {
    const r = await codec().composePair(img(300, 200), full(300, 200), img(400, 100), full(400, 100), 5000);
    const c = cv(0);
    expect([c.width, c.height]).toEqual([300 + 8 + 400, 200]);
    expect(c.fills).toHaveLength(1);
    expect(c.draws.map((d) => d.slice(5))).toEqual([
      [0, 0, 300, 200],
      [308, 0, 400, 100],
    ]);
    expect(r.role).toBe('pair');
    expect(r.mime).toBe('image/jpeg');
    expect(c.encoded).toEqual({ type: 'image/jpeg', quality: 0.85 });
    expect(r.base64.startsWith('data:')).toBe(false);
    expect(r.bytes).toBeGreaterThan(0);
  });
  it('SPEC-MEAS-03, SPEC-AI-11: composePair scales the whole pair so the longest side is at most maxSide', async () => {
    await codec().composePair(img(1000, 2000), full(1000, 2000), img(1000, 2000), full(1000, 2000), 1024);
    const c = cv(0);
    expect(Math.max(c.width, c.height)).toBeLessThanOrEqual(1024);
    expect(c.width).toBe(1024);
    expect(c.draws).toHaveLength(2);
    expect(c.draws[0]?.[7]).toBeGreaterThan(0);
  });
  it('SPEC-MEAS-03: composePair closes every bitmap and rejects an empty rect', async () => {
    await codec().composePair(img(10, 10), full(10, 10), img(10, 10), full(10, 10), 100);
    expect(bitmaps.every((b) => b.closed)).toBe(true);
    expect(await code(codec().composePair(img(10, 10), full(0, 0), img(10, 10), full(10, 10), 100))).toBe(
      'IMAGE_DECODE_FAILED',
    );
  });
});

describe('SPEC-MEAS-04 probe', () => {
  it('SPEC-MEAS-04: returns source width, height and MIME without resampling', async () => {
    const r = await codec().probe(img(2880, 5000, 'image/jpeg'));
    expect(r).toEqual({ width: 2880, height: 5000, mime: 'image/jpeg' });
    expect(canvases).toHaveLength(0);
    expect(bm0().closed).toBe(true);
  });
  it('SPEC-MEAS-04: applies the same MIME, size and decode errors', async () => {
    expect(await code(codec().probe(img(10, 10, 'image/bmp')))).toBe('IMAGE_UNSUPPORTED');
    expect(await code(codec().probe(img(MAX_SOURCE_SIDE + 1, 10)))).toBe('IMAGE_TOO_LARGE');
    expect(await code(codec().probe(new Blob(['x'], { type: 'image/png' })))).toBe('IMAGE_DECODE_FAILED');
  });
});

describe('SPEC-AI-11 letterbox for the on-device model', () => {
  it('crop: a 1440x864 band becomes a 1024 square, grey padding, content centred, result says where', async () => {
    const r = await codec().crop(img(1440, 2000), { x: 0, y: 0, w: 1440, h: 864 }, 1024, 'image/jpeg', {
      letterbox: true,
    });
    const c = cv(0);
    expect([c.width, c.height]).toEqual([1024, 1024]);
    expect(c.fills).toHaveLength(1);
    expect(c.draws[0]?.slice(1)).toEqual([0, 0, 1440, 864, 0, 205, 1024, 614]);
    expect(r.letterbox).toEqual({ side: 1024, dx: 0, dy: 205, w: 1024, h: 614 });
  });

  it('crop without letterbox is unchanged and has no letterbox field', async () => {
    const r = await codec().crop(img(1440, 2000), { x: 0, y: 0, w: 1440, h: 864 }, 1024, 'image/jpeg');
    expect([cv(0).width, cv(0).height]).toEqual([1024, 614]);
    expect(r.letterbox).toBeUndefined();
  });

  it('crop: a tiny region is enlarged (at most 2x) and centred on a square', async () => {
    const r = await codec().crop(img(500, 500), { x: 10, y: 10, w: 100, h: 50 }, 1024, 'image/png', {
      letterbox: true,
    });
    expect([cv(0).width, cv(0).height]).toEqual([200, 200]);
    expect(r.letterbox).toMatchObject({ w: 200, h: 100, dx: 0, dy: 50 });
  });

  it('composePair: a pair wider than 2:1 is stacked, design on top, on a square canvas', async () => {
    const r = await codec().composePair(
      img(400, 200),
      { x: 0, y: 0, w: 250, h: 100 },
      img(400, 200),
      { x: 0, y: 0, w: 250, h: 100 },
      1024,
      {
        letterbox: true,
      },
    );
    const c = cv(0);
    expect(c.width).toBe(c.height);
    expect(r.layout).toBe('stack');
    const [d0, d1] = c.draws;
    expect(d1?.[6]).toBeGreaterThan(d0?.[6] as number); // capture is lower than the design
    expect(d1?.[5]).toBe(d0?.[5]); // same left edge
  });

  it('composePair: a narrow pair stays side by side, still on a square canvas', async () => {
    const r = await codec().composePair(
      img(400, 600),
      { x: 0, y: 0, w: 200, h: 400 },
      img(400, 600),
      { x: 0, y: 0, w: 200, h: 400 },
      1024,
      {
        letterbox: true,
      },
    );
    expect(r.layout).toBe('side');
    expect(cv(0).width).toBe(cv(0).height);
    const [d0, d1] = cv(0).draws;
    expect(d1?.[5]).toBeGreaterThan(d0?.[5] as number);
  });

  it('composePair without letterbox keeps the old side-by-side canvas', async () => {
    const r = await codec().composePair(img(300, 200), full(300, 200), img(400, 100), full(400, 100), 5000);
    expect([cv(0).width, cv(0).height]).toEqual([708, 200]);
    expect(r.layout).toBe('side');
  });
});

describe('browsers without OffscreenCanvas (older Safari, some WebKit builds)', () => {
  const stubDocument = () => {
    const made: { width: number; height: number; draws: unknown[][]; blobArgs?: unknown[] }[] = [];
    vi.stubGlobal('OffscreenCanvas', undefined);
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        expect(tag).toBe('canvas');
        const c = { width: 0, height: 0, draws: [] as unknown[][], blobArgs: undefined as unknown[] | undefined };
        made.push(c);
        return {
          get width() {
            return c.width;
          },
          set width(v: number) {
            c.width = v;
          },
          get height() {
            return c.height;
          },
          set height(v: number) {
            c.height = v;
          },
          getContext: () => ({
            set imageSmoothingQuality(_v: string) {},
            set fillStyle(_v: string) {},
            fillRect: () => {},
            drawImage: (...a: unknown[]) => c.draws.push(a),
            getImageData: (_x: number, _y: number, w: number, h: number) => ({
              width: w,
              height: h,
              data: new Uint8ClampedArray(w * h * 4),
            }),
          }),
          toBlob: (cb: (b: Blob | null) => void, type: string, quality?: number) => {
            c.blobArgs = [type, quality];
            cb(new Blob([`${type}:${c.width}x${c.height}`], { type }));
          },
        };
      },
    });
    return made;
  };

  it('normalise falls back to a canvas element and encodes PNG at the target size', async () => {
    const made = stubDocument();
    const out = await codec().normalise(img(400, 200), 100);
    expect(out.ref).toMatchObject({ mime: 'image/png', width: 100, height: 50 });
    expect(made[0]).toMatchObject({ width: 100, height: 50 });
    expect(made[0]?.blobArgs?.[0]).toBe('image/png');
  });

  it('a canvas that cannot encode is reported as an image error, not a crash', async () => {
    stubDocument();
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ set imageSmoothingQuality(_v: string) {}, drawImage: () => {} }),
        toBlob: (cb: (b: Blob | null) => void) => cb(null),
      }),
    });
    expect(await code(codec().normalise(img(10, 10), 10))).toBe('IMAGE_DECODE_FAILED');
  });
});
