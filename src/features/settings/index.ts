import type { AiEngine, Clock, EngineStatus, Project, ProjectStore, Settings, SettingsStore } from '@kernel';

// Public API of features/settings (SPEC §4.12.1). Bodies: lane C (task 12.x). UI components: lane C (./ui).

export * from './ui';

export interface EngineView {
  device: EngineStatus['device'];
  headline: string;
  detail: string;
  canDownload: boolean;
  imageOnDevice: boolean | 'unknown';
  enableSteps?: string[];
  online: boolean;
  cloud: 'enabled' | 'disabled';
  mode: Settings['mode'];
}

export type PrivacyView =
  | { kind: 'nothing-sent'; text: 'Nothing has left this device' }
  | { kind: 'sent'; requests: number; bytes: number; text: string };

export interface SettingsService {
  read(): Promise<Settings>;
  setMode(m: Settings['mode']): Promise<void>;
  markOnboarded(): Promise<void>;
  engine(): Promise<EngineView>;
  downloadModel(onProgress: (p01: number) => void): Promise<EngineView>; // click handler only
  clearAllData(): Promise<void>; // confirm happens in UI
  privacy(project?: Project): PrivacyView;
}

export function createSettingsService(_d: {
  store: SettingsStore;
  ai: AiEngine;
  projects: ProjectStore;
  clock: Clock;
}): SettingsService {
  throw new Error('not implemented');
}
