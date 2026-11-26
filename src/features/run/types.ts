import type {
  AiEngine,
  Alignment,
  BlobStore,
  Change,
  Clock,
  Confidence,
  ConsentToken,
  DomSnapshot,
  EngineStatus,
  Finding,
  Ids,
  ImageCodec,
  ImageRef,
  MeasureClient,
  Measurement,
  NotCheckedReason,
  PrecomputedJudged,
  ProjectStore,
  Rect,
  RgbaImage,
  Run,
  RunSummary,
  RuntimeConfig,
  SendList,
  Settings,
  Severity,
  Status,
  Thresholds,
  TraceStep,
  ViewportId,
} from '@kernel';

// Internal types of features/run: what a check handler sees and what it returns (SPEC-RUN-03).

/** Everything a handler needs for one viewport. Pixels load lazily and once (see service). */
export interface ViewportCtx {
  viewport: ViewportId;
  t: Thresholds;
  m: MeasureClient;
  dom?: DomSnapshot;
  designImage?: ImageRef;
  captureImage: ImageRef;
  /** Present only when the viewport has a design (SPEC-MEAS-05). */
  alignment?: Alignment;
  designPx(): Promise<RgbaImage | undefined>;
  capturePx(): Promise<RgbaImage | undefined>;
}

export interface Facts {
  measurements: Measurement[];
  selector?: string;
  designCrop?: Rect;
  captureCrop?: Rect;
  diffRatio?: number;
}

/** A deterministic answer (Measured or Visual). `statement` and `fix` are the SPEC-RUN-07 templates. */
export interface ResultOutcome {
  kind: 'result';
  status: Status;
  reason?: NotCheckedReason;
  hint?: string;
  confidence: Confidence;
  severity?: Severity;
  statement?: string;
  fix?: string;
  facts: Facts;
}

/**
 * The handler cannot decide: the Judged stage asks the AI. `cap` is the highest confidence the answer may carry;
 * `strict` (checkType judged) means a `fail` needs High confidence, otherwise it is needs-review (SPEC-RUN-03).
 */
export interface JudgeNeed {
  kind: 'judge';
  cap: Confidence;
  strict: boolean;
  severity: Severity;
  facts: Facts;
}

export type HandlerResult = ResultOutcome | JudgeNeed;

// Public API types (SPEC §4.8.1), declared here so the Judged stage can use them without importing the index.

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
  /** Re-runs only the Judged stage; same Run id (SPEC-RUN-13). */
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
