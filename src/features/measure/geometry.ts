import type { Measurement, Rect, SourceTag, Thresholds } from '@kernel';

// Geometry measurements (SPEC-MEAS-12): sizes and gaps, signed pct to 1 decimal, integer px.

/** Signed percentage change from design to observed, 1 decimal; a zero design gives 0 or +-100. */
export function pct(design: number, observed: number): number {
  const v = design === 0 ? Math.sign(observed) * 100 : ((observed - design) / Math.abs(design)) * 100;
  return Math.round(v * 10) / 10 || 0;
}

export function geometryMeasurement(
  kind: 'size' | 'gap',
  name: string,
  design: number,
  observed: number,
  observedSource: Extract<SourceTag, 'dom-snapshot' | 'capture-image'>,
  t: Thresholds,
): { measurement: Measurement; pass: boolean } {
  const d = Math.round(design);
  const o = Math.round(observed);
  const deltaPct = pct(d, o);
  const tolerance = kind === 'size' ? t.size_tolerance_pct : t.spacing_tolerance_pct;
  return {
    measurement: {
      name,
      design: d,
      observed: o,
      unit: 'px',
      delta: o - d,
      deltaPct,
      source: { design: 'design-image', observed: observedSource },
    },
    pass: Math.abs(deltaPct) <= tolerance,
  };
}

/** Empty space between two boxes along an axis; 0 when they touch or overlap. */
export function gapBetween(a: Rect, b: Rect, axis: 'x' | 'y'): number {
  const [aStart, aSize, bStart, bSize] = axis === 'x' ? [a.x, a.w, b.x, b.w] : [a.y, a.h, b.y, b.h];
  return Math.max(0, bStart - (aStart + aSize), aStart - (bStart + bSize));
}
