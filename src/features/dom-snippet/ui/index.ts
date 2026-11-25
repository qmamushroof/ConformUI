import type { DomSnapshot, ViewportId } from '@kernel';
import type { FC } from 'react';

// UI components of this module (lane C). Re-exported by ../index.ts. Names are frozen at G0; Props interfaces are lane C's.

/** Code block + Copy + 3 steps (PRD-F-13.1). */
export interface SnippetPanelProps {
  onCopy(): void;
}
export const SnippetPanel: FC<SnippetPanelProps> = () => {
  throw new Error('not implemented');
};

export interface SnapshotPasteFieldProps {
  viewport: ViewportId;
  cssWidth: number;
  onAccept(s: DomSnapshot): void;
}
export const SnapshotPasteField: FC<SnapshotPasteFieldProps> = () => {
  throw new Error('not implemented');
};
