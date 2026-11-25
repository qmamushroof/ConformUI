import type {
  AiEngine,
  BlobStore,
  Clock,
  ConsentToken,
  DeepOutput,
  EngineStatus,
  ImageCodec,
  ProjectStore,
  Run,
  RuntimeConfig,
  SettingsStore,
  TraceStep,
} from '@kernel';

// Public API of features/deep-analysis (SPEC §4.9.1). Bodies: lane C (task 12.x). UI components: lane C (./ui).

export * from './ui';

export interface DeepDeps {
  ai: AiEngine;
  config: RuntimeConfig;
  store: ProjectStore;
  blobs: BlobStore;
  codec: ImageCodec;
  settings: SettingsStore;
  clock: Clock;
}

export interface DeepPreview {
  runId: string;
  targets: string[]; // finding ids
  images: { label: string; bytes: number }[];
  contractItems: number;
  measurements: number;
  totalBytes: number;
  model: string;
  remaining: { used: number; cap: number };
}

export type DeepAvailability =
  | { ok: true }
  | { ok: false; reason: 'offline' | 'cloud-disabled' | 'daily-cap' | 'nothing-to-refine' };

export interface DeepService {
  availability(run: Run, status: EngineStatus): Promise<DeepAvailability>;
  preview(run: Run): Promise<DeepPreview>; // what is sent, before any request (PRD-F-06.1)
  /** `consent` has scope 'deep', minted from the trusted Send click. */
  run(p: DeepPreview, consent: ConsentToken, on: (s: TraceStep) => void): Promise<Run>;
  applyPrecomputed(run: Run, deep: DeepOutput): Promise<Run>; // SPEC-DEEP-06 merge, origin 'precomputed' (S29)
}

export function createDeepService(_d: DeepDeps): DeepService {
  throw new Error('not implemented');
}
