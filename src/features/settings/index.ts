import {
  type AiEngine,
  type Clock,
  CuiError,
  type EngineStatus,
  type Project,
  type ProjectStore,
  type Settings,
  type SettingsStore,
} from '@kernel';

// Public API of features/settings (SPEC §4.12.1). Bodies: lane C (task 12.x). UI components: lane C (./ui).

import { engineTexts } from './engine-text';
import type { EngineView, SettingsService } from './types';

export type { EngineView, PrivacyView, SettingsService } from './types';
export * from './ui';

/** Projects that allowed the cloud, for the Settings consent list with Revoke (SPEC-SET-05). */
export function consentList(projects: Project[]): { projectId: string; name: string; grantedAt: number }[] {
  return projects.flatMap((p) =>
    p.cloudConsent ? [{ projectId: p.id, name: p.name, grantedAt: p.cloudConsent.grantedAt }] : [],
  );
}

const MODES: Settings['mode'][] = ['auto', 'cloud-only', 'on-device-only'];

const kb = (bytes: number) => String(Math.max(0.1, Math.round((bytes / 1024) * 10) / 10));

export function createSettingsService(d: {
  store: SettingsStore;
  ai: AiEngine;
  projects: ProjectStore;
  clock: Clock;
}): SettingsService {
  const { store, ai, projects } = d;
  const view = async (s: EngineStatus): Promise<EngineView> => ({
    device: s.device,
    reason: s.reason,
    downloadProgress: s.downloadProgress,
    ...engineTexts(s),
    imageOnDevice: s.deviceImage,
    online: s.online,
    cloud: s.cloud,
    mode: (await store.read()).mode,
  });

  return {
    read: () => store.read(),

    async setMode(m) {
      if (!MODES.includes(m)) throw new Error('Unknown mode');
      await store.write({ mode: m });
    },

    markOnboarded: () => store.write({ onboarded: true }),

    async engine() {
      return view(await ai.status());
    },

    async downloadModel(onProgress) {
      try {
        return await view(await ai.downloadDeviceModel(onProgress));
      } catch (e) {
        throw new CuiError('DEVICE_UNAVAILABLE', undefined, { cause: e });
      }
    },

    // deepUsage is not written, so it survives (SPEC-SET-07).
    async clearAllData() {
      await projects.clearAll();
      await store.write({ mode: 'auto', onboarded: false, everSentToCloud: false });
    },

    privacy(project) {
      if (!project) return { kind: 'nothing-sent', text: 'Nothing has left this device' };
      const { requests, bytes } = project.cloudUsage;
      return {
        kind: 'sent',
        requests,
        bytes,
        text:
          requests === 0
            ? 'Nothing from this project has left this device'
            : `Cloud: ${requests} request${requests === 1 ? '' : 's'} · ${kb(bytes)} KB this project`,
      };
    },
  };
}
