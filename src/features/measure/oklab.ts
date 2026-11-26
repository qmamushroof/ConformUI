import type { Oklab, RgbaImage } from '@kernel';

// sRGB (0..255) to OKLab (Ottosson). Pure maths; shared by ink detection and colour checks.

const lin = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function rgbToOklab(r: number, g: number, b: number): Oklab {
  const lr = lin(r);
  const lg = lin(g);
  const lb = lin(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export const oklabDistance = (p: Oklab, q: Oklab): number => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);

export const pixelOklab = (img: RgbaImage, x: number, y: number): Oklab => {
  const i = (y * img.width + x) * 4;
  return rgbToOklab(img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0);
};
