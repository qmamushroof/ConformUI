import type { Clock, Ids } from './ports';
import type { Contract, Rect, ViewportId } from './types';

// SPEC-KERNEL-08, -10, -11, -12 pure helpers. Bodies arrive with task 3.5.

/** True when every number token in `text` equals (±0.5) a value in `allowed` (SPEC-KERNEL-08). */
export function guardNumbers(_text: string, _allowed: readonly number[]): boolean {
  throw new Error('not implemented');
}

/** Intersection over union; 0 when either area is 0 (SPEC-KERNEL-10). */
export function iou(_a: Rect, _b: Rect): number {
  throw new Error('not implemented');
}

export function lockContract(_c: Contract): Contract {
  throw new Error('not implemented');
}

/** Unlocked copy with `version + 1`, new id, same Requirement ids (SPEC-KERNEL-11). */
export function nextContractVersion(_c: Contract, _ids: Ids, _clock: Clock): Contract {
  throw new Error('not implemented');
}

/** Rule of SPEC-MEAS-04 (SPEC-KERNEL-12). */
export function suggestViewport(_sourceWidth: number): ViewportId {
  throw new Error('not implemented');
}
