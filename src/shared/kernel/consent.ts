import { CuiError } from './errors';
import type { EngineStatus } from './ports';
import type { AiMode, ConsentToken, NotCheckedReason, Settings } from './types';

// SPEC §4.1.4 consent and mode resolution (SPEC-KERNEL-04..06, PRD-P-05, PRD-H-04, PRD-H-05, PRD-D-16, PRD-D-18).

export type ModePlan =
  | { kind: 'call'; mode: AiMode; consent?: ConsentToken }
  | { kind: 'needs-consent'; why: 'device-unavailable' | 'device-downloading' | 'device-no-image' | 'cloud-only-mode' }
  | { kind: 'blocked'; reason: NotCheckedReason };

/**
 * Mints a consent token from a trusted user gesture. Throws CONSENT_REQUIRED unless `ev.isTrusted === true`
 * (a scripted `dispatchEvent` has `isTrusted: false`).
 */
export function mintConsent(
  scope: { scope: 'project'; projectId: string } | { scope: 'deep'; runId: string },
  ev: { isTrusted: boolean },
): ConsentToken {
  if (ev.isTrusted !== true) throw new CuiError('CONSENT_REQUIRED', 'Consent needs a user gesture');
  const token: ConsentToken =
    scope.scope === 'project'
      ? { __brand: 'consent', scope: 'project', projectId: scope.projectId }
      : { __brand: 'consent', scope: 'deep', runId: scope.runId };
  return Object.freeze(token);
}

/** Pure. Never returns a `PREFER_*` plan without a project consent token (S1, PRD-M-06). */
export function resolveMode(i: {
  setting: Settings['mode'];
  purpose: 'first-pass' | 'deep';
  needsImage: boolean;
  status: EngineStatus;
  projectConsent?: ConsentToken;
  deepConsent?: ConsentToken;
}): ModePlan {
  const { status } = i;
  // A token of the wrong scope is no consent (the types forbid it; this guards runtime misuse).
  const project = i.projectConsent?.scope === 'project' ? i.projectConsent : undefined;
  const deep = i.deepConsent?.scope === 'deep' ? i.deepConsent : undefined;

  const offline: ModePlan = { kind: 'blocked', reason: 'offline' };
  const cloudDisabled: ModePlan = { kind: 'blocked', reason: 'cloud-disabled' };
  // The device can answer this request now: available, and able to take images when the request has one.
  const deviceUsable = status.device === 'available' && (!i.needsImage || status.deviceImage === true);

  if (i.purpose === 'deep') {
    // SPEC-KERNEL-04. `on-device-only` [P1] never reaches the cloud, Deep Analysis included.
    if (i.setting === 'on-device-only') return cloudDisabled;
    if (!status.online) return offline;
    if (status.cloud === 'disabled') return cloudDisabled;
    if (!deep) return { kind: 'needs-consent', why: 'cloud-only-mode' };
    return { kind: 'call', mode: 'ONLY_IN_CLOUD', consent: deep };
  }

  if (i.setting === 'on-device-only') {
    // SPEC-KERNEL-06 [P1]
    return deviceUsable ? { kind: 'call', mode: 'ONLY_ON_DEVICE' } : { kind: 'blocked', reason: 'device-unavailable' };
  }

  if (i.setting === 'cloud-only') {
    // SPEC-KERNEL-06
    if (!status.online) return offline;
    if (status.cloud === 'disabled') return cloudDisabled;
    if (!project) return { kind: 'needs-consent', why: 'cloud-only-mode' };
    return { kind: 'call', mode: 'ONLY_IN_CLOUD', consent: project };
  }

  // setting === 'auto'
  if (project) {
    // SPEC-KERNEL-06: with consent the cloud is a permitted fallback (PREFER_ON_DEVICE).
    if (status.cloud === 'disabled') {
      // SPEC-AI-09: a cloud-capable call needs cloud_enabled, so use the device alone or stop.
      return deviceUsable ? { kind: 'call', mode: 'ONLY_ON_DEVICE' } : cloudDisabled;
    }
    if (!status.online && !deviceUsable) return offline;
    return { kind: 'call', mode: 'PREFER_ON_DEVICE', consent: project };
  }

  // SPEC-KERNEL-05: no consent, so only the device may answer.
  if (deviceUsable) return { kind: 'call', mode: 'ONLY_ON_DEVICE' };
  if (status.device === 'available') return { kind: 'needs-consent', why: 'device-no-image' };
  if (status.device === 'downloading') return { kind: 'needs-consent', why: 'device-downloading' };
  return { kind: 'needs-consent', why: 'device-unavailable' };
}
