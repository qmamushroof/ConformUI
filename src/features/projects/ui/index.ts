import type { Project } from '@kernel';
import type { FC } from 'react';

// UI components of this module (lane C). Re-exported by ../index.ts. Names are frozen at G0; Props interfaces are lane C's.

/** Routed screen `/` (SPEC §4.13.2): no props. */
export type ProjectsScreenProps = Record<string, never>;
export const ProjectsScreen: FC<ProjectsScreenProps> = () => {
  throw new Error('not implemented');
};

/** Per-viewport design and capture inputs of one Project (SPEC-PROJ-01). */
export interface ProjectInputsProps {
  project: Project;
}
export const ProjectInputs: FC<ProjectInputsProps> = () => {
  throw new Error('not implemented');
};

/** Button, file picker, drop and paste for one image (SPEC-PROJ-02). */
export interface ImageDropZoneProps {
  label: string;
  onFile(file: File): void;
  disabled?: boolean;
}
export const ImageDropZone: FC<ImageDropZoneProps> = () => {
  throw new Error('not implemented');
};

// StateNotice: one notice for every empty and error state (SPEC-UI-05). Added in 13.1; shared with the other features through `app`.
export type { NoticeCopy, StateNoticeProps } from './state-notice';
export { StateNotice } from './state-notice';
