import type { SendList } from '@kernel';
import type { FC } from 'react';

// UI components of this module (lane C). Re-exported by ../index.ts. Props are the SPEC §4.12.1 signatures.

/** Project cloud consent sheet (PRD-H-05); reused by contract and run screens through `app`. */
export const ConsentSheet: FC<{
  sends: SendList;
  onAllow(ev: { isTrusted: boolean }): void;
  onDecline(): void;
}> = () => {
  throw new Error('not implemented');
};
