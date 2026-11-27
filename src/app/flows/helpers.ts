import { CuiError, type ErrorCode, type NotCheckedReason, type Project } from '@kernel';
import type { ProjectStep } from '@projects';
import { cloudTimeoutCopy, copy, stateCopy } from '../copy';

/** An error as the contract and run screens show it: the notice title and detail, and the code for support. */
export interface ErrorView {
  title: string;
  detail?: string;
  code: string;
}

export function errorView(e: unknown): ErrorView {
  const code: ErrorCode | 'ROUTE_ERROR' = e instanceof CuiError ? e.code : 'ROUTE_ERROR';
  const notice =
    e instanceof CuiError && e.code === 'AI_TIMEOUT' && e.engine === 'cloud' ? cloudTimeoutCopy : stateCopy[code];
  return { title: notice.title, ...(notice.detail && { detail: notice.detail }), code };
}

const REASON_CODE: Partial<Record<NotCheckedReason, ErrorCode>> = {
  offline: 'OFFLINE',
  'cloud-disabled': 'CLOUD_DISABLED',
  'mode-on-device-only': 'CLOUD_DISABLED',
  'device-unavailable': 'DEVICE_UNAVAILABLE',
};

/** A blocked extraction as a notice (SPEC-CON-01 step 1). `errorCode` is the engine error behind `ai-failed`, so a timeout says so. */
export function blockedView(
  reason: NotCheckedReason,
  errorCode?: ErrorCode,
  engine?: 'on-device' | 'cloud',
): ErrorView {
  const code = errorCode === 'AI_TIMEOUT' ? 'AI_TIMEOUT' : (REASON_CODE[reason] ?? 'AI_FAILED');
  // An extraction that failed ran on the device or was sent nowhere: the cloud-unreachable copy would be wrong.
  const notice =
    code === 'AI_FAILED'
      ? copy.flows.extract.failed
      : code === 'AI_TIMEOUT' && engine === 'cloud'
        ? cloudTimeoutCopy
        : stateCopy[code];
  return { title: notice.title, ...(notice.detail && { detail: notice.detail }), code };
}

const ORDER: ProjectStep[] = ['design', 'contract', 'captures', 'run', 'fix', 'reverify'];

/** How far along the six steps a Project is (SPEC-UI-06): steps done from the start, and the suggested next one. */
export function stepper(p: Project, runs: number): { done: number; next: ProjectStep } {
  const state = [p.designs.length > 0, Boolean(p.activeContractId), p.captures.length > 0, runs > 0];
  let done = 0;
  while (done < state.length && state[done]) done++;
  // After a second Run the Fix step is behind the person too (the prototype project page: done 5, next Re-verify).
  if (done === 4 && runs > 1) done = 5;
  return { done, next: ORDER[done] ?? 'reverify' };
}
