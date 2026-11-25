import type { SendList } from '@kernel';
import type { FC } from 'react';

// UI components of this module (lane C). Re-exported by ../index.ts. Names are frozen at G0; Props interfaces are lane C's.

/** Opens `DeepConfirmSheet`; `disabledReason` is the plain-language reason when unavailable (SPEC-DEEP-01). */
export interface DeepAnalysisButtonProps {
  disabledReason?: string;
  onOpen(): void;
}
export const DeepAnalysisButton: FC<DeepAnalysisButtonProps> = () => {
  throw new Error('not implemented');
};

/** Lists what is sent (SPEC-DEEP-02); `onSend` receives the trusted click so the caller can mint consent. */
export interface DeepConfirmSheetProps {
  sends: SendList;
  onSend(ev: { isTrusted: boolean }): void;
  onCancel(): void;
}
export const DeepConfirmSheet: FC<DeepConfirmSheetProps> = () => {
  throw new Error('not implemented');
};
