import type {
  Change,
  Confidence,
  Engine,
  Finding,
  Measurement,
  NotCheckedReason,
  Severity,
  SourceTag,
  ViewportId,
} from '@kernel';

// Display text for the Run screen (SPEC-UI-04, SPEC-RUN-07). Pure; no JSX.

export const VP_NAME: Record<ViewportId, string> = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' };
export const VP_TEXT: Record<ViewportId, string> = {
  desktop: 'Desktop 1440',
  mobile: 'Mobile 390',
  tablet: 'Tablet 768',
};
export const SEVERITY_TEXT: Record<Severity, string> = { critical: 'Critical', major: 'Major', minor: 'Minor' };
export const CONFIDENCE_TEXT: Record<Confidence, string> = { high: 'High', medium: 'Medium', low: 'Low' };
export const CHANGE_TEXT: Record<Change, string> = {
  resolved: 'Resolved',
  remaining: 'Remaining',
  new: 'New',
  regressed: 'Regressed',
  'still-passing': 'Still passing',
};

/** "Not checked: <this>" per reason (SPEC-RUN-07, PRD-P-07). */
export const REASON_TEXT: Record<NotCheckedReason, string> = {
  'no-capture': 'there is no capture for this viewport.',
  'no-dom-snapshot': 'there is no DOM snapshot for this viewport.',
  offline: 'this check needs a model and you are offline.',
  'consent-declined': 'cloud use was declined for this project.',
  'device-unavailable': 'the on-device model is not available.',
  'region-unresolved': 'the region could not be found in the design.',
  misaligned: 'the design and the capture could not be aligned.',
  'outside-capture': 'the region is outside the capture.',
  'ai-invalid-output': 'the model gave an answer that could not be used.',
  'ai-failed': 'the model request failed.',
  'cloud-disabled': 'cloud is turned off.',
  'mode-on-device-only': 'the engine mode is On-device only and no on-device model is ready.',
  'no-inferred-items': 'there are no Inferred items for this viewport.',
};

const SOURCE_TEXT: Record<SourceTag, string> = {
  'dom-snapshot': 'DOM snapshot',
  'design-image': 'design image',
  'capture-image': 'capture image',
  contract: 'contract',
};

export function sourceText(m: Measurement): string {
  const parts = [m.source.design, m.source.observed].filter((s): s is SourceTag => s !== undefined);
  return [...new Set(parts)].map((s) => SOURCE_TEXT[s]).join(' + ');
}

const UNIT: Record<Measurement['unit'], string> = { px: ' px', '%': '%', count: '', deltaE: '' };

const MINUS = '−';
const num = (n: number) => String(Math.abs(Math.round(n * 10) / 10));
const signed = (n: number) => `${n < 0 ? MINUS : n > 0 ? '+' : ''}${num(n)}`;

export function valueText(n: number | undefined, unit: Measurement['unit']): string {
  if (n === undefined || !Number.isFinite(n)) return '';
  const v = `${n < 0 ? MINUS : ''}${num(n)}`;
  return unit === 'deltaE' ? `ΔE ${v}` : `${v}${UNIT[unit]}`;
}

export function deltaText(m: Measurement): string {
  if (m.delta !== undefined && Number.isFinite(m.delta)) {
    if (m.delta === 0) return '0';
    return m.unit === 'deltaE' ? `ΔE ${num(m.delta)}` : `${signed(m.delta)}${UNIT[m.unit]}`;
  }
  if (m.deltaPct !== undefined && Number.isFinite(m.deltaPct)) return `${signed(m.deltaPct)}%`;
  return '';
}

/** The short figure at the right of a Finding row: first measured delta in percent, else the difference ratio. */
export function rowDelta(f: Finding): string {
  const pct = f.evidence.measurements.find((x) => x.deltaPct !== undefined && Number.isFinite(x.deltaPct));
  if (pct?.deltaPct !== undefined) return `${signed(Math.round(pct.deltaPct))}%`;
  const abs = f.evidence.measurements.find((x) => x.delta !== undefined && Number.isFinite(x.delta));
  if (abs) return deltaText(abs);
  const d = f.evidence.diffRatio;
  if (d !== undefined && Number.isFinite(d)) return `${Math.round(d * 100)}%`;
  return '';
}

/** "40% of the region differs." or a plain fallback when no ratio was measured. */
export function diffSentence(ratio: number | undefined): string {
  if (ratio === undefined || !Number.isFinite(ratio)) return 'No difference figure was measured for this region.';
  return `${Math.round(ratio * 100)}% of the region differs.`;
}

export const ENGINE_TEXT: Record<Engine, string> = { 'on-device': 'On-device', cloud: 'Cloud', measured: 'Measured' };

/** Human label of a trace `step` key (SPEC-RUN-01, PRD-F-04.4). */
export function stepLabel(step: string): string {
  const stage = /^(measured|visual)\s+(desktop|mobile|tablet)$/.exec(step);
  if (stage?.[1] && stage[2]) {
    return `${stage[1] === 'measured' ? 'Measured' : 'Visual'} checks, ${VP_NAME[stage[2] as ViewportId]}`;
  }
  if (step === 'judge pre-computed') return 'Judged checks, pre-computed';
  const judge = /^judge\s+(\S+)\s+(desktop|mobile|tablet)$/.exec(step);
  if (judge?.[1] && judge[2]) return `Judged check ${judge[1]}, ${VP_NAME[judge[2] as ViewportId]}`;
  if (step === 'deep') return 'Deep Analysis';
  if (step === 'stopped') return 'Stopped';
  return step ? `${step.charAt(0).toUpperCase()}${step.slice(1)}` : 'Step';
}

export function durationText(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${Math.round(ms / 100) / 10} s`;
}

export function bytesText(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${Math.round((n / (1024 * 1024)) * 10) / 10} MB`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
/** "25 Nov 2026, 14:32" in the viewer's time zone. */
export function dateText(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
