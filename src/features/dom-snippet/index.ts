import { type DomSnapshot, DomSnapshotV1Schema, MAX_SNAPSHOT_BYTES } from '@kernel';
import snippetRaw from './snippet.js?raw';

// Public API of features/dom-snippet (SPEC §4.5.1). Bodies: lane B (task 9.x). UI components: lane C (./ui).

export * from './ui';

export const SNIPPET_VERSION = '1.0.0';

/** snippet.js imported with ?raw: inlined verbatim (not minified). */
export const snippetSource: string = snippetRaw;

/** [P1] 'javascript:' + encodeURIComponent(snippetSource) (PRD-F-13.8). */
export function bookmarkletHref(): string {
  throw new Error('not implemented');
}

const NOT_V1 = 'This is not a ConformUI snapshot v1';
const MAX_MESSAGES = 5;

function jsonErrorLine(text: string, start: number, err: unknown): number {
  const msg = err instanceof Error ? err.message : '';
  const pos = /position (\d+)/.exec(msg);
  const offset = pos ? Number(pos[1]) : 0;
  return text.slice(0, start + offset).split('\n').length;
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (acc, p) => (typeof p === 'number' ? `${acc}[${p}]` : acc ? `${acc}.${String(p)}` : String(p)),
    '',
  );
}

export function parseSnapshot(
  text: string,
  captureViewport: { cssWidth: number },
):
  | { ok: true; snapshot: DomSnapshot; warnings: ('dom-viewport-mismatch' | 'truncated')[] }
  | { ok: false; errors: string[] } {
  // Paste may carry a BOM, whitespace or console noise around the JSON object (SPEC-SNIP-08).
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return { ok: false, errors: ['Not valid JSON (line 1)'] };
  const json = text.slice(start, end + 1);
  // SPEC-SEC-12: size cap before JSON.parse.
  if (new TextEncoder().encode(json).length > MAX_SNAPSHOT_BYTES) return { ok: false, errors: ['SNAPSHOT_TOO_LARGE'] };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (err) {
    return { ok: false, errors: [`Not valid JSON (line ${jsonErrorLine(text, start, err)})`] };
  }
  const head = data as { schema?: unknown; version?: unknown };
  if (head.schema !== 'conformui.dom-snapshot' || head.version !== 1) return { ok: false, errors: [NOT_V1] };
  const parsed = DomSnapshotV1Schema.safeParse(data);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, MAX_MESSAGES).map((i) => {
      const path = formatPath(i.path);
      if (i.code === 'invalid_type') {
        return /received undefined/.test(i.message) ? `${path} is missing` : `${path} must be a ${i.expected}`;
      }
      return path ? `${path}: ${i.message}` : i.message;
    });
    return { ok: false, errors };
  }
  const snapshot = parsed.data;
  const warnings: ('dom-viewport-mismatch' | 'truncated')[] = [];
  if (Math.abs(snapshot.viewport.width - captureViewport.cssWidth) > 1) warnings.push('dom-viewport-mismatch');
  if (snapshot.truncated) warnings.push('truncated');
  return { ok: true, snapshot, warnings };
}
