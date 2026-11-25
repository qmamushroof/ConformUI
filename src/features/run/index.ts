import type {
  AiEngine,
  BlobStore,
  Change,
  Clock,
  ConsentToken,
  EngineStatus,
  Finding,
  Ids,
  ImageCodec,
  MeasureClient,
  PrecomputedJudged,
  ProjectStore,
  Run,
  RunSummary,
  RuntimeConfig,
  SendList,
  Settings,
  TraceStep,
} from '@kernel';

// Public API of features/run (SPEC §4.8.1). Bodies: lane B (task 10.x). UI components: lane C (./ui).

export * from './ui';

export interface RunDeps {
  ai: AiEngine;
  config: RuntimeConfig;
  store: ProjectStore;
  blobs: BlobStore;
  codec: ImageCodec;
  measure: MeasureClient;
  clock: Clock;
  ids: Ids;
}

export type RunEvent =
  | { kind: 'stage'; step: TraceStep }
  | { kind: 'needs-consent'; sends: SendList; resume(c: ConsentToken | null): void };

export interface RunService {
  /** Also used by Re-verify (PRD-F-07.1). */
  start(
    projectId: string,
    ctx: {
      settings: Settings;
      status: EngineStatus;
      projectConsent?: ConsentToken;
      precomputed?: PrecomputedJudged; // sample only, passed by app per Run, §4.11
    },
    on: (e: RunEvent) => void,
    signal?: AbortSignal,
  ): Promise<Run>;
  /** Re-runs only the Judged stage; same Run id, new revision (SPEC-RUN-13). */
  rejudge(
    runId: string,
    ctx: { settings: Settings; status: EngineStatus; projectConsent: ConsentToken },
    on: (e: RunEvent) => void,
  ): Promise<Run>;
  history(projectId: string): Promise<RunSummary[]>; // PRD-F-07.3
  get(runId: string): Promise<Run | undefined>;
  findings(run: Run): Finding[]; // sorted, SPEC-RUN-08
  summary(run: Run): {
    pass: number;
    fail: number;
    review: number;
    notChecked: number;
    changes?: Record<Change, number>;
    line: string;
  };
}

export function createRunService(_d: RunDeps): RunService {
  throw new Error('not implemented');
}

/** Pure, SPEC-RUN-10. */
export function compareRuns(_prev: Run, _next: Run): Record<string, Change> {
  throw new Error('not implemented');
}
