import type { EngineStatus, Project, Settings } from '@kernel';

export interface EngineView {
  device: EngineStatus['device'];
  reason?: EngineStatus['reason'];
  downloadProgress?: number;
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
