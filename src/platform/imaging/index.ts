import {
  ACCEPTED_INPUT_MIME,
  type AiImage,
  CuiError,
  type ImageCodec,
  LETTERBOX_PAD_COLOUR,
  MAX_CSS_HEIGHT,
  MAX_INPUT_BYTES,
  MAX_SOURCE_SIDE,
  type PairLayout,
  planLetterbox,
  planPairLayout,
  type Rect,
} from '@kernel';

// Public API of platform/imaging (SPEC §4.4.1). Decode, resample, crop and encode (SPEC-MEAS-01..04). No network.

const JPEG_QUALITY = 0.85;
const PAIR_GAP = 8;

const fail = (
  code: 'IMAGE_UNSUPPORTED' | 'IMAGE_TOO_LARGE' | 'IMAGE_DECODE_FAILED',
  message: string,
  cause?: unknown,
) => new CuiError(code, message, cause === undefined ? undefined : { cause });

function checkInput(file: Blob): void {
  if (!(ACCEPTED_INPUT_MIME as readonly string[]).includes(file.type)) {
    throw fail('IMAGE_UNSUPPORTED', 'Only PNG, JPEG or WebP images are accepted.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw fail('IMAGE_TOO_LARGE', 'The image is larger than the 20 MiB limit.');
  }
}

async function decode(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch (e) {
    throw fail('IMAGE_DECODE_FAILED', 'The image could not be read.', e);
  }
}

async function withBitmap<T>(blob: Blob, fn: (bm: ImageBitmap) => Promise<T> | T): Promise<T> {
  const bm = await decode(blob);
  try {
    return await fn(bm);
  } finally {
    bm.close();
  }
}

function context(w: number, h: number): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw fail('IMAGE_DECODE_FAILED', 'Image processing is not available.');
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

function paintWhite(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, x = 0, y = 0): void {
  ctx.fillStyle = 'white';
  ctx.fillRect(x, y, w, h);
}

function encode(canvas: OffscreenCanvas, mime: 'image/jpeg' | 'image/png'): Promise<Blob> {
  return canvas.convertToBlob(mime === 'image/jpeg' ? { type: mime, quality: JPEG_QUALITY } : { type: mime });
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function clampRect(r: Rect, bm: ImageBitmap): Rect {
  const x = Math.max(0, Math.round(r.x));
  const y = Math.max(0, Math.round(r.y));
  const w = Math.min(bm.width, Math.round(r.x + r.w)) - x;
  const h = Math.min(bm.height, Math.round(r.y + r.h)) - y;
  if (!(w > 0 && h > 0)) throw fail('IMAGE_DECODE_FAILED', 'The region is outside the image.');
  return { x, y, w, h };
}

const scaleFor = (longest: number, maxSide: number) => (longest > maxSide ? maxSide / longest : 1);
const dim = (n: number, s: number) => Math.max(1, Math.round(n * s));

export function createImageCodec(): ImageCodec {
  return {
    async normalise(file, cssWidth) {
      checkInput(file);
      if (!Number.isFinite(cssWidth) || cssWidth <= 0) throw fail('IMAGE_DECODE_FAILED', 'Invalid target width.');
      return withBitmap(file, async (bm) => {
        if (bm.width > MAX_SOURCE_SIDE || bm.height > MAX_SOURCE_SIDE) {
          throw fail('IMAGE_TOO_LARGE', 'The image is larger than the 8192 px per side limit.');
        }
        const height = Math.max(1, Math.round((bm.height * cssWidth) / bm.width));
        if (height > MAX_CSS_HEIGHT) {
          throw fail('IMAGE_TOO_LARGE', 'The image is taller than the 16000 px limit at this width.');
        }
        const { canvas, ctx } = context(cssWidth, height);
        ctx.drawImage(bm, 0, 0, cssWidth, height);
        const blob = await encode(canvas, 'image/png');
        return { blob, ref: { mime: 'image/png', width: cssWidth, height, cssWidth, bytes: blob.size } };
      });
    },

    async pixels(blob) {
      return withBitmap(blob, (bm) => {
        const { ctx } = context(bm.width, bm.height);
        ctx.drawImage(bm, 0, 0);
        const d = ctx.getImageData(0, 0, bm.width, bm.height);
        return { width: d.width, height: d.height, data: d.data };
      });
    },

    async crop(blob, r, maxSide, mime, opts) {
      return withBitmap(blob, async (bm) => {
        const c = clampRect(r, bm);
        if (opts?.letterbox) {
          const lb = planLetterbox(c.w, c.h, maxSide);
          const { canvas, ctx } = context(lb.side, lb.side);
          ctx.fillStyle = LETTERBOX_PAD_COLOUR;
          ctx.fillRect(0, 0, lb.side, lb.side);
          ctx.drawImage(bm, c.x, c.y, c.w, c.h, lb.dx, lb.dy, lb.w, lb.h);
          const out = await encode(canvas, mime);
          return { mime, base64: await toBase64(out), bytes: out.size, role: 'design', blob: out, letterbox: lb };
        }
        const s = scaleFor(Math.max(c.w, c.h), maxSide);
        const w = dim(c.w, s);
        const h = dim(c.h, s);
        const { canvas, ctx } = context(w, h);
        if (mime === 'image/jpeg') paintWhite(ctx, w, h);
        ctx.drawImage(bm, c.x, c.y, c.w, c.h, 0, 0, w, h);
        const out = await encode(canvas, mime);
        return { mime, base64: await toBase64(out), bytes: out.size, role: 'design', blob: out };
      });
    },

    async composePair(design, dr, capture, cr, maxSide, opts): Promise<AiImage & { layout?: PairLayout }> {
      return withBitmap(design, (dbm) =>
        withBitmap(capture, async (cbm) => {
          const d = clampRect(dr, dbm);
          const c = clampRect(cr, cbm);
          const layout: PairLayout = opts?.letterbox ? planPairLayout(d, c) : 'side';
          const stacked = layout === 'stack';
          const totalW = stacked ? Math.max(d.w, c.w) : d.w + PAIR_GAP + c.w;
          const totalH = stacked ? d.h + PAIR_GAP + c.h : Math.max(d.h, c.h);
          if (opts?.letterbox) {
            const lb = planLetterbox(totalW, totalH, maxSide);
            const s = lb.w / totalW;
            const { canvas, ctx } = context(lb.side, lb.side);
            ctx.fillStyle = LETTERBOX_PAD_COLOUR;
            ctx.fillRect(0, 0, lb.side, lb.side);
            paintWhite(ctx, lb.w, lb.h, lb.dx, lb.dy);
            ctx.drawImage(dbm, d.x, d.y, d.w, d.h, lb.dx, lb.dy, dim(d.w, s), dim(d.h, s));
            const cx = stacked ? 0 : (d.w + PAIR_GAP) * s;
            const cy = stacked ? (d.h + PAIR_GAP) * s : 0;
            ctx.drawImage(
              cbm,
              c.x,
              c.y,
              c.w,
              c.h,
              lb.dx + Math.round(cx),
              lb.dy + Math.round(cy),
              dim(c.w, s),
              dim(c.h, s),
            );
            const out = await encode(canvas, 'image/jpeg');
            return { mime: 'image/jpeg', base64: await toBase64(out), bytes: out.size, role: 'pair', layout };
          }
          const s = scaleFor(Math.max(totalW, totalH), maxSide);
          const w = dim(totalW, s);
          const h = dim(totalH, s);
          const { canvas, ctx } = context(w, h);
          paintWhite(ctx, w, h);
          ctx.drawImage(dbm, d.x, d.y, d.w, d.h, 0, 0, dim(d.w, s), dim(d.h, s));
          ctx.drawImage(cbm, c.x, c.y, c.w, c.h, Math.round((d.w + PAIR_GAP) * s), 0, dim(c.w, s), dim(c.h, s));
          const out = await encode(canvas, 'image/jpeg');
          return { mime: 'image/jpeg', base64: await toBase64(out), bytes: out.size, role: 'pair', layout: 'side' };
        }),
      );
    },

    async probe(file) {
      checkInput(file);
      return withBitmap(file, (bm) => {
        if (bm.width > MAX_SOURCE_SIDE || bm.height > MAX_SOURCE_SIDE) {
          throw fail('IMAGE_TOO_LARGE', 'The image is larger than the 8192 px per side limit.');
        }
        return { width: bm.width, height: bm.height, mime: file.type };
      });
    },
  };
}
