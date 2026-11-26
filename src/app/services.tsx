import type { ContractService } from '@contract';
import type { DeepService } from '@deep';
import type {
  AiEngine,
  BlobStore,
  Clock,
  Ids,
  ImageCodec,
  MeasureClient,
  ProjectStore,
  RuntimeConfig,
  SettingsStore,
} from '@kernel';
import type { ProjectsService } from '@projects';
import type { RunService } from '@run';
import type { SettingsService } from '@settings';
import { createContext, type FC, type ReactNode, useContext } from 'react';

// SPEC-APP-01: the service graph, provided to route components through React context. Features get what they need
// as props from the route components; they never import `app`.

export interface Services {
  projects: ProjectsService;
  contract: ContractService;
  run: RunService;
  deep: DeepService;
  settings: SettingsService;
  store: ProjectStore;
  blobs: BlobStore;
  settingsStore: SettingsStore;
  codec: ImageCodec;
  measure: MeasureClient;
  ai: AiEngine;
  config: RuntimeConfig;
  clock: Clock;
  ids: Ids;
  /** Calls `listener` whenever the AI engine finishes loading (or fails to), so status views can refresh. */
  onEngineChange(listener: () => void): () => void;
}

const Context = createContext<Services | null>(null);

export const ServicesProvider: FC<{ services: Services; children: ReactNode }> = ({ services, children }) => (
  <Context.Provider value={services}>{children}</Context.Provider>
);

export function useServices(): Services {
  const s = useContext(Context);
  if (!s) throw new Error('useServices must be used inside ServicesProvider');
  return s;
}
