import type { DomSnapshot } from '@kernel';
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

export function parseSnapshot(
  _text: string,
  _captureViewport: { cssWidth: number },
):
  | { ok: true; snapshot: DomSnapshot; warnings: ('dom-viewport-mismatch' | 'truncated')[] }
  | { ok: false; errors: string[] } {
  throw new Error('not implemented');
}
