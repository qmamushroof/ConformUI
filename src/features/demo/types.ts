import type { Contract, DomSnapshot, PrecomputedJudged } from '@kernel';

export interface SampleAssets {
  design: { desktop: Blob };
  flawed: Record<'desktop' | 'mobile', { image: Blob; dom: DomSnapshot }>;
  fixed: Record<'desktop' | 'mobile', { image: Blob; dom: DomSnapshot }>;
  contract: Contract;
  precomputed: PrecomputedJudged; // kernel
}
