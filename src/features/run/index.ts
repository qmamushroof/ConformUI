import type { Change, Run } from '@kernel';
import { compareRuns as compare } from './compare';

// Public API of features/run (SPEC §4.8.1). Bodies: lane B (task 10.x). UI components: lane C (./ui).

export { createRunService } from './service';
export type { RunDeps, RunEvent, RunService } from './types';
export * from './ui';

/** Pure, SPEC-RUN-10. */
export function compareRuns(prev: Run, next: Run): Record<string, Change> {
  return compare(prev, next);
}
