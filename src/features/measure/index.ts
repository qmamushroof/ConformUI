import type { MeasureApi, MeasureClient } from '@kernel';
import { locateOnCapture } from './locate';
import { snapRegion } from './snap';

// Public API of features/measure (SPEC §4.4.1). Bodies: lane B (task 8.x).

export const measureApi: MeasureApi = {
  align: () => {
    throw new Error('not implemented');
  },
  snapRegion,
  locateOnCapture,
  regionDiff: () => {
    throw new Error('not implemented');
  },
  inkRatio: () => {
    throw new Error('not implemented');
  },
  dominantColour: () => {
    throw new Error('not implemented');
  },
  deltaE: () => {
    throw new Error('not implemented');
  },
  matchElements: () => {
    throw new Error('not implemented');
  },
  overflowFacts: () => {
    throw new Error('not implemented');
  },
  overlaps: () => {
    throw new Error('not implemented');
  },
  pct: () => {
    throw new Error('not implemented');
  },
};

/** Async wrapper over `measureApi`; used by `app` in release 1 (S22). */
export function inlineMeasureClient(): MeasureClient {
  throw new Error('not implemented');
}
