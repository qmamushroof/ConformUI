import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RgbaImage } from '@kernel';
import { encodePng, solidImage } from '../../helpers/node-codec';

// Deterministic image fixtures (SPEC §7.3). `writeFixtures(dir)` rewrites the committed files; the test asserts they match the builders.

const WHITE: [number, number, number, number] = [255, 255, 255, 255];

function block(img: RgbaImage, x: number, y: number, w: number, h: number, rgb: [number, number, number]) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) img.data.set([...rgb, 255], (yy * img.width + xx) * 4);
  }
}

// A dark box with a 1 px edge ring; the two variants differ only in the ring grey (anti-aliasing).
function aaOnly(ring: number) {
  const img = solidImage(100, 60, WHITE);
  block(img, 20, 20, 60, 30, [ring, ring, ring]);
  block(img, 21, 21, 58, 28, [20, 20, 20]);
  return encodePng(img);
}

function missingElement(withButton: boolean) {
  const img = solidImage(200, 120, WHITE);
  block(img, 0, 0, 200, 20, [240, 240, 240]);
  if (withButton) block(img, 40, 40, 60, 30, [30, 90, 200]);
  return encodePng(img);
}

// 1x1 lossless WebP: the app accepts the type, the Node codec cannot decode it.
const WEBP_BASE64 = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

export const fixtureBuilders: Record<string, () => Uint8Array> = {
  'aa-only-a.png': () => aaOnly(200),
  'aa-only-b.png': () => aaOnly(180),
  'missing-element-with.png': () => missingElement(true),
  'missing-element-without.png': () => missingElement(false),
  'tall-page.png': () => encodePng(solidImage(390, 16_200, WHITE)),
  'oversized.png': () => encodePng(solidImage(8193, 10, WHITE)),
  'sample.webp': () => new Uint8Array(Buffer.from(WEBP_BASE64, 'base64')),
};

export function writeFixtures(dir: string): void {
  for (const [name, build] of Object.entries(fixtureBuilders)) writeFileSync(resolve(dir, name), build());
}
