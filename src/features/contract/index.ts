import type {
  ConsentToken,
  Contract,
  EngineStatus,
  ManualRequirementDraft,
  Rect,
  Requirement,
  Settings,
  TraceStep,
} from '@kernel';

// Public API of features/contract (SPEC §4.7.1). UI components: lane C (./ui).

import { runExtract } from './extract';
import * as review from './review';
import type { ContractDeps, ExtractOutcome } from './types';

export * from './ui';

export type { ContractDeps, ExtractOutcome };

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

export function createContractService(d: ContractDeps): ContractService {
  return {
    extract: (projectId, ctx, onProgress) => runExtract(d, projectId, ctx, onProgress),
    async active(projectId) {
      const id = (await d.store.get(projectId))?.activeContractId;
      return id ? d.store.getContract(id) : undefined;
    },
    accept: (id, reqIds) => review.accept(d, id, reqIds),
    editText: (id, reqId, patch) => review.editText(d, id, reqId, patch),
    remove: (id, reqId) => review.remove(d, id, reqId),
    add: (id, draft) => review.add(d, id, draft),
    setRegion: (id, reqId, rect) => review.setRegion(d, id, reqId, rect),
    loadCommitted: (projectId, c) => review.loadCommitted(d, projectId, c),
    useAiContract: (projectId) => review.useAiContract(d, projectId),
    loadPrecomputedExtraction: (projectId, reqs) => review.loadPrecomputedExtraction(d, projectId, reqs),
  };
}
