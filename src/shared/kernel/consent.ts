import type { EngineStatus } from './ports';
import type { AiMode, ConsentToken, NotCheckedReason, Settings } from './types';

// SPEC §4.1.4 consent and mode resolution (SPEC-KERNEL-04..06). Bodies arrive with task 3.5.

export type ModePlan =
  | { kind: 'call'; mode: AiMode; consent?: ConsentToken }
  | { kind: 'needs-consent'; why: 'device-unavailable' | 'device-downloading' | 'device-no-image' | 'cloud-only-mode' }
  | { kind: 'blocked'; reason: NotCheckedReason };

/** Throws CONSENT_REQUIRED unless `ev.isTrusted`. */
export function mintConsent(
  _scope: { scope: 'project'; projectId: string } | { scope: 'deep'; runId: string },
  _ev: { isTrusted: boolean },
): ConsentToken {
  throw new Error('not implemented');
}

export function resolveMode(_i: {
  setting: Settings['mode'];
  purpose: 'first-pass' | 'deep';
  needsImage: boolean;
  status: EngineStatus;
  projectConsent?: ConsentToken;
  deepConsent?: ConsentToken;
}): ModePlan {
  throw new Error('not implemented');
}
