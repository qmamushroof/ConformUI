import type {
  Alignment,
  Confidence,
  DomSnapshot,
  ImageRef,
  MeasureClient,
  Measurement,
  NotCheckedReason,
  Rect,
  RgbaImage,
  Severity,
  Status,
  Thresholds,
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
