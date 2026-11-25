import type {
  AiEngine,
  BlobStore,
  Clock,
  ConsentToken,
  Contract,
  EngineStatus,
  Ids,
  ImageCodec,
  ManualRequirementDraft,
  MeasureClient,
  ModePlan,
  NotCheckedReason,
  ProjectStore,
  Rect,
  Requirement,
  RuntimeConfig,
  SendList,
  Settings,
  TraceStep,
} from '@kernel';

// Public API of features/contract (SPEC §4.7.1). Bodies: lane C (task 11.x). UI components: lane C (./ui).

export * from './ui';

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
  | { kind: 'blocked'; reason: NotCheckedReason; contract: Contract /*rule-based items only*/ };

export interface ContractService {
  extract(
    projectId: string,
    ctx: { settings: Settings; status: EngineStatus; projectConsent?: ConsentToken },
    onProgress: (s: TraceStep) => void,
  ): Promise<ExtractOutcome>;
  active(projectId: string): Promise<Contract | undefined>;
  accept(contractId: string, reqIds: string[] | 'all'): Promise<Contract>;
  editText(contractId: string, reqId: string, patch: { statement?: string; condition?: string }): Promise<Contract>;
  remove(contractId: string, reqId: string): Promise<Contract>;
  add(contractId: string, draft: ManualRequirementDraft): Promise<Contract>;
  setRegion(contractId: string, reqId: string, rect: Rect): Promise<Contract>; // [P1] region drawing (PRD-F-03.3)
  loadCommitted(projectId: string, c: Contract): Promise<Contract>; // sample (§4.11)
  useAiContract(projectId: string): Promise<Contract>; // sample: pendingAiContractId → active (SPEC-DEMO-03)
  loadPrecomputedExtraction(projectId: string, reqs: Requirement[]): Promise<Contract>; // stored as pendingAiContractId, origin 'precomputed' (S29)
}

export function createContractService(_d: ContractDeps): ContractService {
  throw new Error('not implemented');
}
