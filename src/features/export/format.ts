import type {
  Confidence,
  Contract,
  Engine,
  Finding,
  Measurement,
  NotCheckedReason,
  Project,
  Run,
  Severity,
  SourceTag,
  ViewportId,
} from '@kernel';
import { VIEWPORT_PRESETS } from '@kernel';

// Pure text helpers shared by the export functions (SPEC §4.10). No I/O, no clock reads.

export const APP_VERSION = '0.1.0';
export const MAX_TEXT = 400;

const VIEWPORT_ORDER: readonly ViewportId[] = ['desktop', 'mobile', 'tablet'];
const SEVERITY_ORDER: readonly Severity[] = ['critical', 'major', 'minor'];

export const VIEWPORT_NAME: Record<ViewportId, string> = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' };
export const SEVERITY_NAME: Record<Severity, string> = { critical: 'Critical', major: 'Major', minor: 'Minor' };
export const ENGINE_NAME: Record<Engine, string> = { 'on-device': 'On-device', cloud: 'Cloud', measured: 'Measured' };
export const CONFIDENCE_NAME: Record<Confidence, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const SOURCE_NAME: Record<SourceTag, string> = {
  'dom-snapshot': 'DOM snapshot',
  'design-image': 'design image',
  'capture-image': 'capture image',
  contract: 'contract',
};
export const REASON_TEXT: Record<NotCheckedReason, string> = {
  'no-capture': 'no capture for this viewport',
  'no-dom-snapshot': 'no DOM snapshot',
  offline: 'offline',
  'consent-declined': 'cloud consent declined',
  'device-unavailable': 'on-device model unavailable',
  'region-unresolved': 'region unresolved',
  misaligned: 'design and capture misaligned',
  'outside-capture': 'region outside the capture',
  'ai-invalid-output': 'AI output invalid',
  'ai-failed': 'AI request failed',
  'cloud-disabled': 'cloud disabled',
  'mode-on-device-only': 'on-device only mode',
  'no-inferred-items': 'no inferred items',
};

/** Collapse whitespace and control characters, neutralise HTML, cap length. */
export function plain(text: string, max = MAX_TEXT): string {
  let s = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    s += code < 32 || code === 127 ? ' ' : ch;
  }
  s = s.replace(/\s+/g, ' ').trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

/** `plain` plus Markdown escapes, safe inside a table cell or a line. */
export function md(text: string, max = MAX_TEXT): string {
  return plain(text, max).replace(/([\\`*_[\]|#])/g, '\\$1');
}

const num = (n: number): string => String(Number(n.toFixed(1)));

function withUnit(n: number, unit: Measurement['unit']): string {
  if (unit === 'px') return `${num(n)} px`;
  if (unit === '%') return `${num(n)}%`;
  if (unit === 'deltaE') return `${num(n)} deltaE`;
  return num(n);
}

export function measurementText(m: Measurement): string {
  const parts: string[] = [];
  if (m.observed !== undefined) parts.push(`${withUnit(m.observed, m.unit)} (${SOURCE_NAME[m.source.observed]})`);
  if (m.design !== undefined) {
    const src = m.source.design ? ` (${SOURCE_NAME[m.source.design]})` : '';
    parts.push(`vs ${withUnit(m.design, m.unit)}${src}`);
  }
  let text = `${m.name}: ${parts.join(' ')}`.trimEnd();
  if (m.deltaPct !== undefined) text += `, ${num(m.deltaPct)}%`;
  return text;
}

export const compareFindings = (a: Finding, b: Finding): number =>
  SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
  (a.status === b.status ? 0 : a.status === 'fail' ? -1 : 1) ||
  (a.label === b.label ? 0 : a.label === 'explicit' ? -1 : 1) ||
  VIEWPORT_ORDER.indexOf(a.viewport) - VIEWPORT_ORDER.indexOf(b.viewport) ||
  cmp(a.requirementId, b.requirementId) ||
  cmp(a.id, b.id);

export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortViewports(list: Iterable<ViewportId>): ViewportId[] {
  const set = new Set(list);
  return VIEWPORT_ORDER.filter((v) => set.has(v));
}

export function runViewports(run: Run): ViewportId[] {
  return sortViewports(run.results.map((r) => r.viewport));
}

export function projectViewports(p: Project, c: Contract, run?: Run): ViewportId[] {
  return sortViewports([
    ...p.designs.map((d) => d.viewport),
    ...p.captures.map((x) => x.viewport),
    ...c.requirements.map((r) => r.viewport),
    ...(run ? run.results.map((r) => r.viewport) : []),
  ]);
}

export const viewportWithWidth = (v: ViewportId): string => `${VIEWPORT_NAME[v]} ${VIEWPORT_PRESETS[v]} px`;

export const isoDate = (at: number): string => new Date(at).toISOString().slice(0, 10);
export const isoTime = (at: number): string => new Date(at).toISOString();

/** Page origin and path only: query and hash can carry secrets. */
export function pageUrl(p: Project, run: Run): string | undefined {
  const ids = new Set(run.captureIds);
  const cap = p.captures.find((c) => ids.has(c.id)) ?? p.captures[0];
  const raw = cap?.dom?.page.url;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return `${u.origin}${u.pathname}`;
  } catch {
    return undefined;
  }
}

export function slug(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return s || 'project';
}

export const stamp = (at: number): string => {
  const iso = new Date(at).toISOString();
  return `${iso.slice(0, 10).replace(/-/g, '')}-${iso.slice(11, 13)}${iso.slice(14, 16)}`;
};
