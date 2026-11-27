import {
  ACCEPTED_INPUT_MIME,
  CuiError,
  type ImageCodec,
  MAX_CSS_HEIGHT,
  MAX_INPUT_BYTES,
  MAX_SOURCE_SIDE,
  planLetterbox,
  planPairLayout,
  type Rect,
  type RgbaImage,
} from '@kernel';
import { PNG } from 'pngjs';

// Node ImageCodec over pngjs for tests (SPEC §7.4). Mirrors platform/imaging, but decodes PNG only:
// normalise passes through PNGs already at cssWidth, JPEG output is refused, and the pair is a PNG.

const PAIR_GAP = 8;
const PAD: [number, number, number, number] = [128, 128, 128, 255];

const fail = (
  code: 'IMAGE_UNSUPPORTED' | 'IMAGE_TOO_LARGE' | 'IMAGE_DECODE_FAILED',
  message: string,
  cause?: unknown,
) => new CuiError(code, message, cause === undefined ? undefined : { cause });

export function solidImage(width: number, height: number, rgba: [number, number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width, height, data };
}

export function encodePng(img: RgbaImage): Uint8Array {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  return new Uint8Array(PNG.sync.write(png));
}

export const pngBlob = (img: RgbaImage): Blob => new Blob([encodePng(img) as BlobPart], { type: 'image/png' });

async function decode(blob: Blob): Promise<RgbaImage> {
  try {
    const png = PNG.sync.read(Buffer.from(await blob.arrayBuffer()));
    return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
  } catch (e) {
    throw fail('IMAGE_DECODE_FAILED', 'The image could not be read.', e);
  }
}

function checkInput(file: Blob): void {
  if (!(ACCEPTED_INPUT_MIME as readonly string[]).includes(file.type)) {
    throw fail('IMAGE_UNSUPPORTED', 'Only PNG, JPEG or WebP images are accepted.');
  }
  if (file.size > MAX_INPUT_BYTES) throw fail('IMAGE_TOO_LARGE', 'The image is larger than the 20 MiB limit.');
}

function checkSide(img: RgbaImage): void {
  if (img.width > MAX_SOURCE_SIDE || img.height > MAX_SOURCE_SIDE) {
    throw fail('IMAGE_TOO_LARGE', 'The image is larger than the 8192 px per side limit.');
  }
}

function clampRect(r: Rect, img: RgbaImage): Rect {
  const x = Math.max(0, Math.round(r.x));
  const y = Math.max(0, Math.round(r.y));
  const w = Math.min(img.width, Math.round(r.x + r.w)) - x;
  const h = Math.min(img.height, Math.round(r.y + r.h)) - y;
  if (!(w > 0 && h > 0)) throw fail('IMAGE_DECODE_FAILED', 'The region is outside the image.');
  return { x, y, w, h };
}

const scaleFor = (longest: number, maxSide: number) => (longest > maxSide ? maxSide / longest : 1);
const dim = (n: number, s: number) => Math.max(1, Math.round(n * s));

// Paints region `r` of `src` scaled to (dw, dh) onto `dst` at (dx, dy), nearest neighbour.
function paint(dst: RgbaImage, src: RgbaImage, r: Rect, dx: number, dy: number, dw: number, dh: number): void {
  for (let y = 0; y < dh; y++) {
    const sy = r.y + Math.min(r.h - 1, Math.floor(((y + 0.5) * r.h) / dh));
    for (let x = 0; x < dw; x++) {
      const sx = r.x + Math.min(r.w - 1, Math.floor(((x + 0.5) * r.w) / dw));
      const from = (sy * src.width + sx) * 4;
      dst.data.set(src.data.subarray(from, from + 4), ((dy + y) * dst.width + dx + x) * 4);
    }
  }
}

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

export function createNodeImageCodec(): ImageCodec {
  return {
    async normalise(file, cssWidth) {
      checkInput(file);
      if (!Number.isFinite(cssWidth) || cssWidth <= 0) throw fail('IMAGE_DECODE_FAILED', 'Invalid target width.');
      const img = await decode(file);
      checkSide(img);
      if (img.height > MAX_CSS_HEIGHT) throw fail('IMAGE_TOO_LARGE', 'The image is taller than the 16000 px limit.');
      if (img.width !== cssWidth) throw fail('IMAGE_DECODE_FAILED', 'The test codec does not resample.');
      return {
        blob: file,
        ref: { mime: 'image/png', width: img.width, height: img.height, cssWidth, bytes: file.size },
      };
    },

    pixels: decode,

    async crop(blob, r, maxSide, mime, opts) {
      if (mime !== 'image/png') throw fail('IMAGE_UNSUPPORTED', 'The test codec encodes PNG only.');
      const src = await decode(blob);
      const c = clampRect(r, src);
      const lb = opts?.letterbox ? planLetterbox(c.w, c.h, maxSide) : undefined;
      const s = scaleFor(Math.max(c.w, c.h), maxSide);
      const out = lb ? solidImage(lb.side, lb.side, PAD) : solidImage(dim(c.w, s), dim(c.h, s), [0, 0, 0, 0]);
      if (lb) paint(out, src, c, lb.dx, lb.dy, lb.w, lb.h);
      else paint(out, src, c, 0, 0, out.width, out.height);
      const bytes = encodePng(out);
      return {
        mime,
        base64: toBase64(bytes),
        bytes: bytes.length,
        role: 'design',
        blob: new Blob([bytes as BlobPart], { type: mime }),
        ...(lb && { letterbox: lb }),
      };
    },

    async composePair(design, dr, capture, cr, maxSide, opts) {
      const dsrc = await decode(design);
      const csrc = await decode(capture);
      const d = clampRect(dr, dsrc);
      const c = clampRect(cr, csrc);
      if (opts?.letterbox) {
        const layout = planPairLayout(d, c);
        const stacked = layout === 'stack';
        const totalW = stacked ? Math.max(d.w, c.w) : d.w + PAIR_GAP + c.w;
        const totalH = stacked ? d.h + PAIR_GAP + c.h : Math.max(d.h, c.h);
        const lb = planLetterbox(totalW, totalH, maxSide);
        const s = lb.w / totalW;
        const out = solidImage(lb.side, lb.side, PAD);
        for (let y = lb.dy; y < lb.dy + lb.h; y++) {
          for (let x = lb.dx; x < lb.dx + lb.w; x++) out.data.set([255, 255, 255, 255], (y * out.width + x) * 4);
        }
        paint(out, dsrc, d, lb.dx, lb.dy, Math.min(lb.w, dim(d.w, s)), Math.min(lb.h, dim(d.h, s)));
        const cx = lb.dx + (stacked ? 0 : Math.round((d.w + PAIR_GAP) * s));
        const cy = lb.dy + (stacked ? Math.round((d.h + PAIR_GAP) * s) : 0);
        paint(out, csrc, c, cx, cy, Math.min(out.width - cx, dim(c.w, s)), Math.min(out.height - cy, dim(c.h, s)));
        const bytes = encodePng(out);
        return { mime: 'image/png', base64: toBase64(bytes), bytes: bytes.length, role: 'pair', layout };
      }
      const s = scaleFor(Math.max(d.w + PAIR_GAP + c.w, Math.max(d.h, c.h)), maxSide);
      const out = solidImage(dim(d.w + PAIR_GAP + c.w, s), dim(Math.max(d.h, c.h), s), [255, 255, 255, 255]);
      paint(out, dsrc, d, 0, 0, Math.min(out.width, dim(d.w, s)), Math.min(out.height, dim(d.h, s)));
      const cx = Math.round((d.w + PAIR_GAP) * s);
      paint(out, csrc, c, cx, 0, Math.min(out.width - cx, dim(c.w, s)), Math.min(out.height, dim(c.h, s)));
      const bytes = encodePng(out);
      return { mime: 'image/png', base64: toBase64(bytes), bytes: bytes.length, role: 'pair', layout: 'side' };
    },

    async probe(file) {
      checkInput(file);
      const img = await decode(file);
      checkSide(img);
      return { width: img.width, height: img.height, mime: file.type };
    },
  };
}
