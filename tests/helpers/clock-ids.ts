import type { Clock, Ids } from '@kernel';

// Deterministic Clock and Ids for tests (SPEC-TEST-01 style fakes).

export interface FixedClock extends Clock {
  advance(ms: number): void;
}

export function fixedClock(start = 1_700_000_000_000): FixedClock {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
}

export function sequentialIds(prefix = 'id'): Ids {
  let n = 0;
  return { next: () => `${prefix}-${++n}` };
}
