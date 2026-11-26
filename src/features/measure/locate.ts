import type { Rect, RgbaImage, Thresholds } from '@kernel';

// locateOnCapture (SPEC-MEAS-08): coarse search on 1/4-scale grayscale, refine +-3 px at full scale.
// Costs are integer sums, so ties are exact: smallest |dy|, then |dx|, then dy, then dx.

const COARSE_STEP = 4;
const DX_RANGE = 24;
const REFINE = 3;

interface Plane {
  w: number;
  h: number;
  v: Uint8Array;
}

function grayPlane(img: RgbaImage): Plane {
  const v = new Uint8Array(img.width * img.height);
  for (let i = 0; i < v.length; i++) {
    const p = i * 4;
    v[i] = Math.round(0.299 * (img.data[p] ?? 0) + 0.587 * (img.data[p + 1] ?? 0) + 0.114 * (img.data[p + 2] ?? 0));
  }
  return { w: img.width, h: img.height, v };
}

// Box-averages s x s blocks of `p` starting at (px, py) into a cw x ch plane.
function reduce(p: Plane, px: number, py: number, cw: number, ch: number, s: number): Plane {
  const v = new Uint8Array(cw * ch);
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      let sum = 0;
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) sum += p.v[(py + j * s + y) * p.w + px + i * s + x] ?? 0;
      v[j * cw + i] = Math.round(sum / (s * s));
    }
  }
  return { w: cw, h: ch, v };
}

function sad(a: Plane, b: Plane, bx: number, by: number): number {
  let sum = 0;
  for (let y = 0; y < a.h; y++) {
    const ra = y * a.w;
    const rb = (by + y) * b.w + bx;
    for (let x = 0; x < a.w; x++) sum += Math.abs((a.v[ra + x] ?? 0) - (b.v[rb + x] ?? 0));
  }
  return sum;
}

interface Cand {
  cost: number;
  dx: number;
  dy: number;
}

const better = (a: Cand, b: Cand | undefined): boolean => {
  if (!b) return true;
  if (a.cost !== b.cost) return a.cost < b.cost;
  if (Math.abs(a.dy) !== Math.abs(b.dy)) return Math.abs(a.dy) < Math.abs(b.dy);
  if (Math.abs(a.dx) !== Math.abs(b.dx)) return Math.abs(a.dx) < Math.abs(b.dx);
  if (a.dy !== b.dy) return a.dy < b.dy;
  return a.dx < b.dx;
};

export function locateOnCapture(
  design: RgbaImage,
  dr: Rect,
  capture: RgbaImage,
  t: Thresholds,
): { rect: Rect; score: number } {
  const x0 = Math.max(0, Math.min(design.width - 1, Math.round(dr.x)));
  const y0 = Math.max(0, Math.min(design.height - 1, Math.round(dr.y)));
  const w = Math.max(1, Math.min(design.width - x0, Math.round(dr.w)));
  const h = Math.max(1, Math.min(design.height - y0, Math.round(dr.h)));
  const at = (dx: number, dy: number): Rect => ({ x: x0 + dx, y: y0 + dy, w, h });
  const none = { rect: at(0, 0), score: 0 };
  if (w > capture.width || h > capture.height) return none;

  const dg = grayPlane(design);
  const cg = grayPlane(capture);
  const crop = reduce(dg, x0, y0, w, h, 1);
  const inBounds = (dx: number, dy: number) =>
    x0 + dx >= 0 && y0 + dy >= 0 && x0 + dx + w <= capture.width && y0 + dy + h <= capture.height;

  // Coarse pass on blocks of s px (1/4 scale; full scale when the crop is smaller than a block).
  const s = Math.min(w, h) >= COARSE_STEP ? COARSE_STEP : 1;
  const w4 = Math.floor(w / s);
  const h4 = Math.floor(h / s);
  const phx = x0 % s;
  const phy = y0 % s;
  const gw = Math.floor((capture.width - phx) / s);
  const gh = Math.floor((capture.height - phy) / s);
  const small = reduce(dg, x0, y0, w4, h4, s);
  const grid = reduce(cg, phx, phy, gw, gh, s);
  const reach = Math.floor(Math.round(t.search_window_px) / s) * s;
  let best: Cand | undefined;
  for (let dy = -reach; dy <= reach; dy += s) {
    for (let dx = -DX_RANGE; dx <= DX_RANGE; dx += s) {
      if (!inBounds(dx, dy)) continue;
      const bx = (x0 + dx - phx) / s;
      const by = (y0 + dy - phy) / s;
      if (bx < 0 || by < 0 || bx + w4 > gw || by + h4 > gh) continue;
      const c: Cand = { cost: sad(small, grid, bx, by), dx, dy };
      if (better(c, best)) best = c;
    }
  }
  if (!best) return none;

  // Refinement at full scale around the coarse winner.
  let fine: Cand | undefined;
  for (let dy = best.dy - REFINE; dy <= best.dy + REFINE; dy++) {
    for (let dx = best.dx - REFINE; dx <= best.dx + REFINE; dx++) {
      if (!inBounds(dx, dy)) continue;
      const c: Cand = { cost: sad(crop, cg, x0 + dx, y0 + dy), dx, dy };
      if (better(c, fine)) fine = c;
    }
  }
  if (!fine) return none;
  return { rect: at(fine.dx, fine.dy), score: 1 - fine.cost / (w * h * 255) };
}
