import type { ManualRequirementDraft, Requirement, ViewportId } from '@kernel';
import type { FC } from 'react';

// UI components of this module (lane C). Re-exported by ../index.ts. Names are frozen at G0; Props interfaces are lane C's.

/** Routed screen `/p/:projectId/contract` (SPEC §4.13.2): no props. */
export type ContractScreenProps = Record<string, never>;
export const ContractScreen: FC<ContractScreenProps> = () => {
  throw new Error('not implemented');
};

export interface RequirementRowProps {
  requirement: Requirement;
  onAccept?(): void;
  onReject?(): void;
  onEdit?(): void;
}
export const RequirementRow: FC<RequirementRowProps> = () => {
  throw new Error('not implemented');
};

export interface RequirementEditorProps {
  viewport: ViewportId;
  requirement?: Requirement;
  onSave(draft: ManualRequirementDraft): void;
  onCancel(): void;
}
export const RequirementEditor: FC<RequirementEditorProps> = () => {
  throw new Error('not implemented');
};
