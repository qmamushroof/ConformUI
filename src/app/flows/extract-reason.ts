import { CuiError, type ErrorCode, type NotCheckedReason } from '@kernel';
import { copy } from '../copy';

// SPEC-DEMO-05, PRD-H-05: why an extraction did not produce an AI contract, so the screen states the real reason
// (never "you declined" unless the person declined).

export type FallbackWhy = 'declined' | 'timeout' | 'failed' | 'offline' | 'device' | 'cloud-disabled';

/** A blocked extraction outcome: the reason plus the engine error behind it, when there was one. */
export function whyFromBlocked(reason: NotCheckedReason, code?: ErrorCode): FallbackWhy {
  if (code === 'AI_TIMEOUT') return 'timeout';
  switch (reason) {
    case 'offline':
      return 'offline';
    case 'device-unavailable':
      return 'device';
    case 'cloud-disabled':
    case 'mode-on-device-only':
      return 'cloud-disabled';
    default:
      return 'failed';
  }
}

/** An error thrown out of the extraction. */
export function whyFromError(e: unknown): FallbackWhy {
  if (!(e instanceof CuiError)) return 'failed';
  if (e.code === 'AI_TIMEOUT') return 'timeout';
  if (e.code === 'OFFLINE') return 'offline';
  return 'failed';
}

/** The sentence under "Sample results (pre-computed)". With no recorded reason (after a reload) it blames nobody. */
export function precomputedNote(why: FallbackWhy | undefined): string {
  const p = copy.flows.extract.precomputed;
  return why ? `${p[why]} ${p.tail}` : p.tail;
}
