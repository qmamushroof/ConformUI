import type { AiImage, ImageCodec, RunSummary, SendList } from '@kernel';
import { describe, expect, it } from 'vitest';

// SPEC §4.1.3: compile-time shape of the ports added in step 0 (checked by `tsc -b` over tests/).

describe('SPEC-KERNEL-02, SPEC-MEAS-04: kernel ports and shared value types', () => {
  it('SPEC-MEAS-04: ImageCodec declares probe(file) -> { width, height, mime } next to normalise/pixels/crop/composePair', async () => {
    const image: AiImage & { blob: Blob } = {
      mime: 'image/png',
      base64: '',
      bytes: 0,
      role: 'pair',
      blob: new Blob([]),
    };
    const codec: ImageCodec = {
      normalise: async (_f, cssWidth) => ({
        blob: new Blob([]),
        ref: { mime: 'image/png', width: cssWidth, height: 1, cssWidth, bytes: 0 },
      }),
      pixels: async () => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) }),
      crop: async () => image,
      composePair: async () => image,
      probe: async () => ({ width: 780, height: 1600, mime: 'image/png' }),
    };
    expect(await codec.probe(new Blob([]))).toEqual({ width: 780, height: 1600, mime: 'image/png' });
  });

  it('SPEC-KERNEL-02: SendList and RunSummary are kernel types (S29)', () => {
    const send: SendList = { images: [{ label: 'Design, desktop', bytes: 1000 }], text: ['Prompt'] };
    const summary: RunSummary = {
      id: 'r',
      createdAt: 1,
      contractVersion: 1,
      viewports: ['desktop'],
      pass: 1,
      fail: 2,
      review: 3,
    };
    expect(send.images[0]?.bytes).toBe(1000);
    expect(summary.fail + summary.review).toBe(5);
  });
});
