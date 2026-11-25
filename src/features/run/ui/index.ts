import type { Finding, RunSummary, TraceStep } from '@kernel';
import type { FC } from 'react';

// UI components of this module (lane C). Re-exported by ../index.ts. Names are frozen at G0; Props interfaces are lane C's.

/** Routed screen `/p/:projectId/run/:runId` (SPEC §4.13.2): no props. */
export type RunScreenProps = Record<string, never>;
export const RunScreen: FC<RunScreenProps> = () => {
  throw new Error('not implemented');
};

export interface FindingListProps {
  findings: readonly Finding[];
  selectedId?: string;
  onSelect(findingId: string): void;
}
export const FindingList: FC<FindingListProps> = () => {
  throw new Error('not implemented');
};

export interface FindingDetailProps {
  finding: Finding;
}
export const FindingDetail: FC<FindingDetailProps> = () => {
  throw new Error('not implemented');
};

/** Design crop and capture crop side by side (SPEC-UI-01). */
export interface ComparisonViewProps {
  finding: Finding;
  design?: Blob;
  capture?: Blob;
}
export const ComparisonView: FC<ComparisonViewProps> = () => {
  throw new Error('not implemented');
};

export interface EngineTraceProps {
  trace: readonly TraceStep[];
}
export const EngineTrace: FC<EngineTraceProps> = () => {
  throw new Error('not implemented');
};

export interface RunHistoryProps {
  runs: readonly RunSummary[];
  currentRunId?: string;
  onOpen(runId: string): void;
}
export const RunHistory: FC<RunHistoryProps> = () => {
  throw new Error('not implemented');
};
