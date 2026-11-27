import type { Rect } from './types';

// Letterboxing for the on-device model (SPEC-AI-11). Chrome stretches a non-square image to a square before the model
// sees it ("Image input will be stretched ... This may adversely affect AI model comprehension"). So the app draws the
// region on a square canvas with neutral padding and maps the model's boxes back through the padding offset and scale.
// Pure functions, no DOM.

/** Neutral padding colour: not white (a page background) and not black (text). */
export const LETTERBOX_PAD_COLOUR = 'rgb(128 128 128)';
/** Smaller images are enlarged up to 2x so that at least this side is reached. */
const MIN_SIDE = 448;
const MAX_UPSCALE = 2;
/** Context around a region: at least this margin, and never a thinner than 1:3 or wider than 3:1 shape. */
const CONTEXT_MARGIN = 16;
const CONTEXT_MARGIN_RATIO = 0.25;
const MAX_ASPECT = 3;
const PAIR_STACK_ASPECT = 2;

/** Where the content sits on the square canvas, in output pixels. */
export interface Letterbox {
  side: number;
  dx: number;
  dy: number;
  w: number;
  h: number;
}

export function planLetterbox(srcW: number, srcH: number, maxSide: number): Letterbox {
  const longest = Math.max(srcW, srcH, 1);
  const s = longest > maxSide ? maxSide / longest : longest < MIN_SIDE ? Math.min(MAX_UPSCALE, MIN_SIDE / longest) : 1;
  const w = Math.max(1, Math.round(srcW * s));
  const h = Math.max(1, Math.round(srcH * s));
  const side = Math.max(w, h);
  return { side, dx: Math.floor((side - w) / 2), dy: Math.floor((side - h) / 2), w, h };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Model box [ymin, xmin, ymax, xmax] (0..1000 of the square canvas) to a rect in the source's own CSS px. */
export function rectFromNormalised(box: readonly [number, number, number, number], src: Rect, lb: Letterbox): Rect {
  const [a, b, c, d] = box;
  const toX = (n: number) => clamp(((n / 1000) * lb.side - lb.dx) / lb.w, 0, 1) * src.w;
  const toY = (n: number) => clamp(((n / 1000) * lb.side - lb.dy) / lb.h, 0, 1) * src.h;
  const x0 = toX(Math.min(b, d));
  const x1 = toX(Math.max(b, d));
  const y0 = toY(Math.min(a, c));
  const y1 = toY(Math.max(a, c));
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  return {
    x: src.x + Math.min(x0, Math.max(0, src.w - w)),
    y: src.y + Math.min(y0, Math.max(0, src.h - h)),
    w,
    h,
  };
}

/** Smallest box side the app believes, in thousandths of the image: thinner is a collapsed or invented box. */
const MIN_BOX_EXTENT = 3;
const MIN_CONTENT_OVERLAP = 0.5;
const UNPADDED: Letterbox = { side: 1000, dx: 0, dy: 0, w: 1000, h: 1000 };

export interface BoxRead {
  rect: Rect;
  /** `canvas`: as the prompt says. `content`: the model ignored the padding and drew relative to the picture only. */
  reading: 'canvas' | 'content';
  /** `normalised` 0..1000, `unit` 0..1 fractions, `pixels` of the canvas that was sent. */
  scale: 'normalised' | 'unit' | 'pixels';
}

/**
 * A model box [ymin, xmin, ymax, xmax] to a CSS rect in `src`, tolerating the scales models actually answer in
 * (0..1 fractions, pixels of the canvas) and a box drawn without regard to the padding. `pixelSide` is the canvas side
 * in pixels when it is known. Returns undefined for a box that is not believable (negative, not finite, collapsed).
 */
export function readBox(
  raw: readonly [number, number, number, number],
  src: Rect,
  lb: Letterbox,
  pixelSide?: number,
): BoxRead | undefined {
  if (raw.some((n) => !Number.isFinite(n) || n < 0)) return undefined;
  const max = Math.max(...raw);
  let scale: BoxRead['scale'] = 'normalised';
  let f = 1;
  if (max <= 1) {
    scale = 'unit';
    f = 1000;
  } else if (max > 1000) {
    if (!pixelSide || max > pixelSide * 1.02) return undefined;
    scale = 'pixels';
    f = 1000 / pixelSide;
  }
  const n = raw.map((v) => Math.min(1000, v * f)) as [number, number, number, number];
  const ymin = Math.min(n[0], n[2]);
  const ymax = Math.max(n[0], n[2]);
  const xmin = Math.min(n[1], n[3]);
  const xmax = Math.max(n[1], n[3]);
  if (ymax - ymin < MIN_BOX_EXTENT || xmax - xmin < MIN_BOX_EXTENT) return undefined;

  const cx0 = (lb.dx / lb.side) * 1000;
  const cx1 = ((lb.dx + lb.w) / lb.side) * 1000;
  const cy0 = (lb.dy / lb.side) * 1000;
  const cy1 = ((lb.dy + lb.h) / lb.side) * 1000;
  const iw = Math.max(0, Math.min(xmax, cx1) - Math.max(xmin, cx0));
  const ih = Math.max(0, Math.min(ymax, cy1) - Math.max(ymin, cy0));
  const onContent = (iw * ih) / ((xmax - xmin) * (ymax - ymin));
  if (onContent >= MIN_CONTENT_OVERLAP) return { rect: rectFromNormalised(n, src, lb), reading: 'canvas', scale };
  return { rect: rectFromNormalised(n, src, UNPADDED), reading: 'content', scale };
}

/** The inverse of {@link rectFromNormalised}: a rect inside `src` to [ymin, xmin, ymax, xmax] on the canvas. */
export function rectToNormalised(rect: Rect, src: Rect, lb: Letterbox): [number, number, number, number] {
  const fx = (x: number) => ((((x - src.x) / src.w) * lb.w + lb.dx) / lb.side) * 1000;
  const fy = (y: number) => ((((y - src.y) / src.h) * lb.h + lb.dy) / lb.side) * 1000;
  return [fy(rect.y), fx(rect.x), fy(rect.y + rect.h), fx(rect.x + rect.w)];
}

/** A region plus context: a margin around it and a moderate aspect ratio, inside `bounds` (integers). */
export function contextRect(r: Rect, bounds: { w: number; h: number }): Rect {
  const margin = Math.max(CONTEXT_MARGIN, CONTEXT_MARGIN_RATIO * Math.min(r.w, r.h));
  let x0 = r.x - margin;
  let y0 = r.y - margin;
  let w = r.w + 2 * margin;
  let h = r.h + 2 * margin;
  if (w / h > MAX_ASPECT) {
    const nh = Math.ceil(w / MAX_ASPECT);
    y0 -= (nh - h) / 2;
    h = nh;
  } else if (h / w > MAX_ASPECT) {
    const nw = Math.ceil(h / MAX_ASPECT);
    x0 -= (nw - w) / 2;
    w = nw;
  }
  w = Math.min(w, bounds.w);
  h = Math.min(h, bounds.h);
  x0 = clamp(x0, 0, bounds.w - w);
  y0 = clamp(y0, 0, bounds.h - h);
  const x = Math.floor(x0);
  const y = Math.floor(y0);
  return {
    x,
    y,
    w: Math.min(bounds.w, Math.ceil(x0 + w)) - x,
    h: Math.min(bounds.h, Math.ceil(y0 + h)) - y,
  };
}

export type PairLayout = 'side' | 'stack';

/** Design left and implementation right, unless that is wider than 2:1; then design on top and implementation below. */
export function planPairLayout(design: { w: number; h: number }, capture: { w: number; h: number }): PairLayout {
  const wide = (design.w + capture.w) / Math.max(design.h, capture.h, 1);
  return wide > PAIR_STACK_ASPECT ? 'stack' : 'side';
}
