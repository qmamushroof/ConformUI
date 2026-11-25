import type { Contract, DomSnapshot, PrecomputedJudged, Requirement } from '@kernel';

// Public API of features/demo (SPEC §4.11.1). Bodies: lane B (task 9.x). UI components: lane C (./ui).

export * from './ui';

export interface SampleAssets {
  design: { desktop: Blob };
  flawed: Record<'desktop' | 'mobile', { image: Blob; dom: DomSnapshot }>;
  fixed: Record<'desktop' | 'mobile', { image: Blob; dom: DomSnapshot }>;
  contract: Contract;
  precomputed: PrecomputedJudged; // kernel
}

/** Lazy: import.meta.glob(…, { query: '?url' }) + fetch. */
export function loadSampleAssets(): Promise<SampleAssets> {
  throw new Error('not implemented');
}

/** Same category and region IoU >= 0.5, via kernel `iou` (PRD-M-14). */
export function compareWithVerified(
  _ai: Requirement[],
  _verified: Requirement[],
): { matched: string[]; missing: string[]; extra: string[] } {
  throw new Error('not implemented');
}
