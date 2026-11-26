import type { Alignment, DomSnapshot, ImageMeta, Thresholds } from '@kernel';

// Alignment (SPEC-MEAS-05): both images are at CSS scale, top-left anchored, so only widths and heights are compared.

export function align(design: ImageMeta, capture: ImageMeta & { dom?: DomSnapshot }, t: Thresholds): Alignment {
  const captureWidth = capture.dom?.viewport.width ?? capture.cssWidth;
  const raw = design.cssWidth > 0 ? (Math.abs(captureWidth - design.cssWidth) / design.cssWidth) * 100 : 100;
  const issues: Alignment['issues'] = [];
  if (raw > t.width_mismatch_pct) issues.push('width-mismatch');
  if (design.height !== capture.height) issues.push('height-differs');
  return {
    ok: !issues.includes('width-mismatch'),
    widthDeltaPct: Math.round(raw * 10) / 10,
    heightDesign: design.height,
    heightCapture: capture.height,
    issues,
  };
}
