import type { TraceStep } from '@kernel';
import { USAGE_EVENT } from '../hooks';
import type { Services } from '../services';

// SPEC-APP-01, SPEC-SET-06: every Cloud TraceStep adds its bytes to the Project's `cloudUsage` and sets
// `everSentToCloud` once. Measured and On-device steps add nothing. The pre-computed stand-in step reports engine
// `cloud` but sent nothing, so it is skipped.

let chain: Promise<void> = Promise.resolve();

export const sentToCloud = (step: TraceStep): boolean => step.engine === 'cloud' && step.note !== 'pre-computed';

/** Serialised, so concurrent steps never overwrite each other's read-modify-write of `cloudUsage`. */
export function recordCloudStep(s: Pick<Services, 'projects' | 'settingsStore'>, projectId: string, step: TraceStep) {
  if (!sentToCloud(step)) return chain;
  chain = chain
    .then(async () => {
      await s.projects.recordCloudUsage(projectId, step.bytesSent);
      const settings = await s.settingsStore.read();
      if (!settings.everSentToCloud) await s.settingsStore.write({ everSentToCloud: true });
      window.dispatchEvent(new Event(USAGE_EVENT));
    })
    .catch(() => undefined);
  return chain;
}

/** Resolves when every step recorded so far has been stored. */
export const usageIdle = (): Promise<void> => chain;
