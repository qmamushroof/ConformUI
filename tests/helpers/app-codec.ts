import { Blob as NodeBlob } from 'node:buffer';
import type { ImageCodec } from '@kernel';
import { createNodeImageCodec, encodePng, solidImage } from './node-codec';

// The Node codec for app-level component tests. The sample design is a 2x export that the browser codec scales to
// CSS width (SPEC-MEAS-02); the Node codec does not resample, so this wrapper averages 2x2 blocks for that one case.

export function createAppTestCodec(): ImageCodec {
  const base = createNodeImageCodec();
  return {
    ...base,
    // The Node codec encodes PNG only; the extraction and Deep requests ask for JPEG, which the fake engine never decodes.
    async crop(blob, r, maxSide, mime) {
      const out = await base.crop(blob, r, maxSide, 'image/png');
      return mime === 'image/jpeg' ? { ...out, mime } : out;
    },
    async normalise(file, cssWidth) {
      const src = await base.pixels(file);
      if (src.width !== cssWidth * 2) return base.normalise(file, cssWidth);
      const out = solidImage(cssWidth, Math.floor(src.height / 2), [255, 255, 255, 255]);
      for (let y = 0; y < out.height; y++) {
        for (let x = 0; x < out.width; x++) {
          for (let c = 0; c < 4; c++) {
            let sum = 0;
            for (const [dx, dy] of [
              [0, 0],
              [1, 0],
              [0, 1],
              [1, 1],
            ] as const) {
              sum += src.data[((2 * y + dy) * src.width + 2 * x + dx) * 4 + c] ?? 0;
            }
            out.data[(y * out.width + x) * 4 + c] = Math.round(sum / 4);
          }
        }
      }
      const blob = new NodeBlob([new Uint8Array(encodePng(out))], { type: 'image/png' }) as unknown as Blob;
      return { blob, ref: { mime: 'image/png', width: out.width, height: out.height, cssWidth, bytes: blob.size } };
    },
  };
}
