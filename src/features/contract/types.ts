import type {
  AiEngine,
  BlobStore,
  Clock,
  Contract,
  ErrorCode,
  Ids,
  ImageCodec,
  MeasureClient,
  ModePlan,
  NotCheckedReason,
  ProjectStore,
  RuntimeConfig,
  SendList,
} from '@kernel';

// Shared by index.ts and extract.ts (no import cycle).

export interface ContractDeps {
  ai: AiEngine;
  config: RuntimeConfig;
  store: ProjectStore;
  blobs: BlobStore;
  codec: ImageCodec;
  clock: Clock;
  ids: Ids;
  measure: MeasureClient; // kernel type; app passes inlineMeasureClient()
}

export type ExtractOutcome =
  | { kind: 'done'; contract: Contract }
  | { kind: 'needs-consent'; plan: ModePlan; sends: SendList }
  | {
      kind: 'blocked';
      reason: NotCheckedReason;
      /** The engine error behind `reason`, when there was one (a timeout and a failure are both `ai-failed`). */
      errorCode?: ErrorCode;
      contract: Contract /*rule-based items only*/;
    };
