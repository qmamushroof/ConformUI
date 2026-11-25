import type { DomSnapshot, ViewportId } from '@kernel';
import type { FC } from 'react';

// UI components of this module (lane C). Re-exported by ../index.ts. Props are the SPEC §4.5.1 signatures.

/** Code block + Copy + 3 steps (PRD-F-13.1). */
export const SnippetPanel: FC<{ onCopy(): void }> = () => {
  throw new Error('not implemented');
};

export const SnapshotPasteField: FC<{
  viewport: ViewportId;
  cssWidth: number;
  onAccept(s: DomSnapshot): void;
}> = () => {
  throw new Error('not implemented');
};
