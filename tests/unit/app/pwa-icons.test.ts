import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// SPEC-PWA-01: two owner sources, generated icons committed under public/.
const read = (p: string) => readFileSync(p);

function pngSize(file: string): { width: number; height: number } {
  const b = read(file);
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(b.subarray(12, 16).toString('latin1')).toBe('IHDR');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function icoEntries(file: string): { width: number; height: number }[] {
  const b = read(file);
  expect(b.readUInt16LE(0)).toBe(0);
  expect(b.readUInt16LE(2)).toBe(1);
  const count = b.readUInt16LE(4);
  expect(b.length).toBeGreaterThanOrEqual(6 + count * 16);
  return Array.from({ length: count }, (_, i) => {
    const o = 6 + i * 16;
    const size = b.readUInt32LE(o + 8);
    const offset = b.readUInt32LE(o + 12);
    expect(offset + size).toBeLessThanOrEqual(b.length);
    return { width: b[o] || 256, height: b[o + 1] || 256 };
  });
}

describe('SPEC-PWA-01 owner sources', () => {
  it('SPEC-PWA-01: public/icon.svg is byte-identical to docs/brand/logo.svg', () => {
    expect(read('public/icon.svg').equals(read('docs/brand/logo.svg'))).toBe(true);
  });
  it('SPEC-PWA-01: public/favicon.svg is byte-identical to docs/brand/favicon.svg', () => {
    expect(read('public/favicon.svg').equals(read('docs/brand/favicon.svg'))).toBe(true);
  });
});

describe('SPEC-PWA-01 generated PNGs', () => {
  it.each([
    ['public/pwa-192x192.png', 192],
    ['public/pwa-512x512.png', 512],
    ['public/maskable-icon-512x512.png', 512],
    ['public/apple-touch-icon-180x180.png', 180],
  ])('SPEC-PWA-01: %s is %i px square', (file, px) => {
    expect(pngSize(file)).toEqual({ width: px, height: px });
  });
  it('SPEC-PWA-01: no icon is generated below 48 px except the favicon', () => {
    expect(() => read('public/pwa-64x64.png')).toThrow();
  });
});

describe('SPEC-PWA-01 favicon.ico', () => {
  it('SPEC-PWA-01: is a valid ICO with at least one entry', () => {
    expect(icoEntries('public/favicon.ico').length).toBeGreaterThanOrEqual(1);
  });
  it('SPEC-PWA-01: every entry is square and 16 or 32 px', () => {
    for (const e of icoEntries('public/favicon.ico')) {
      expect(e.width).toBe(e.height);
      expect([16, 32]).toContain(e.width);
    }
  });
  it('SPEC-PWA-01: contains the 32 px entry (fallback minimum when the generator emits one size)', () => {
    expect(icoEntries('public/favicon.ico').map((e) => e.width)).toContain(32);
  });
});
