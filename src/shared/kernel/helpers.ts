import type { Clock, Ids } from './ports';
import type { Contract, Rect, ViewportId } from './types';
import { VIEWPORT_PRESETS } from './types';

// SPEC-KERNEL-08, -10, -11, -12 pure helpers.

// SPEC-KERNEL-08 tokenisation. Group 1 is an optional minus sign, valid only when not preceded by a word character
// or a dot ("10-20" is 10 and 20; "2-column" is 2). Group 2 is the number: thousands form `[1-9]\d{0,2}(,\d{3})+`
// (optional `.\d+`), else digits with an optional decimal part separated by `.` or `,`.
const NUMBER_TOKEN = /(?:(?<![\w.])(-))?([1-9]\d{0,2}(?:,\d{3})+(?:\.\d+)?(?!\d)|\d+(?:[.,]\d+)?)/g;
const THOUSANDS = /^[1-9]\d{0,2}(?:,\d{3})+(?:\.\d+)?$/;
// Requirement ids: explicit `R-01`, inferred `I-D-01` / `I-M-01` / `I-T-01` (SPEC §4.1.1); labels, not values.
const REQUIREMENT_ID = /\b(?:R|I-[A-Z])-\d+\b/g;
const TOLERANCE = 0.5;

/**
 * True when every number token in `text` equals (±0.5) a value in `allowed` (SPEC-KERNEL-08). A `false` result means
 * the caller falls back to the deterministic template and records `numberGuardTripped`. Tokenisation: U+2212 reads as
 * `-`; requirement ids are removed first; a `-` is a sign only when not preceded by a word character or `.`;
 * `d{1,3}(,ddd)+` (first group not 0) is a thousands separator, any other comma between digits is a decimal point.
 */
export function guardNumbers(text: string, allowed: readonly number[]): boolean {
  const cleaned = text.replaceAll('−', '-').replace(REQUIREMENT_ID, ' ');
  for (const m of cleaned.matchAll(NUMBER_TOKEN)) {
    const body = m[2] ?? '';
    const value = Number(THOUSANDS.test(body) ? body.replaceAll(',', '') : body.replace(',', '.'));
    const n = m[1] ? -value : value;
    if (!allowed.some((a) => Math.abs(n - a) <= TOLERANCE)) return false;
  }
  return true;
}

/** Intersection over union; 0 when either area is 0 (SPEC-KERNEL-10). */
export function iou(a: Rect, b: Rect): number {
  if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) return 0;
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  return inter / (a.w * a.h + b.w * b.h - inter);
}

export function lockContract(c: Contract): Contract {
  return { ...c, locked: true };
}

/** Unlocked copy with `version + 1`, new id, same Requirement ids (SPEC-KERNEL-11). */
export function nextContractVersion(c: Contract, ids: Ids, clock: Clock): Contract {
  return { ...structuredClone(c), id: ids.next(), version: c.version + 1, createdAt: clock.now(), locked: false };
}

/** Viewports the app offers in release 1 (PRD-D-25); Tablet is [P1] and joins this list then. */
const SUGGESTABLE: readonly ViewportId[] = ['desktop', 'mobile'];
const BAND_DENOMINATOR = 20; // within 5 %: |css - preset| <= preset / 20
const DESKTOP_FLOOR_CSS_PX = 1024;

/**
 * Rule of SPEC-MEAS-04 (SPEC-KERNEL-12): of `sourceWidth / dpr` for dpr 1, 2, 3, the candidate closest to a preset
 * within 5 % names that preset; else Desktop from 1024 CSS px, otherwise Mobile. Invalid widths give Desktop.
 */
export function suggestViewport(sourceWidth: number): ViewportId {
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) return 'desktop';
  let best: { viewport: ViewportId; distance: number } | undefined;
  for (const dpr of [1, 2, 3]) {
    const css = sourceWidth / dpr;
    for (const viewport of SUGGESTABLE) {
      const preset = VIEWPORT_PRESETS[viewport];
      if (Math.abs(css - preset) * BAND_DENOMINATOR > preset) continue;
      const distance = Math.abs(css - preset) / preset;
      if (!best || distance < best.distance) best = { viewport, distance }; // ties keep the lower dpr, then desktop
    }
  }
  if (best) return best.viewport;
  return sourceWidth >= DESKTOP_FLOOR_CSS_PX ? 'desktop' : 'mobile';
}
