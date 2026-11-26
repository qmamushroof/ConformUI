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

/** Projects that allowed the cloud, for the Settings consent list with Revoke (SPEC-SET-05). */
export function consentList(projects: Project[]): { projectId: string; name: string; grantedAt: number }[] {
  return projects.flatMap((p) =>
    p.cloudConsent ? [{ projectId: p.id, name: p.name, grantedAt: p.cloudConsent.grantedAt }] : [],
  );
}

const MODES: Settings['mode'][] = ['auto', 'cloud-only', 'on-device-only'];

// SPEC-SET-02: copy-paste steps; a page cannot open chrome:// links, so the user copies them.
const ENABLE_STEPS = [
  'Open chrome://flags/#prompt-api-multimodal-input',
  'Open chrome://flags/#gemma4-for-built-in-ai',
  'Set both to Enabled',
  'Relaunch Chrome',
  'Come back and press Download model',
];

const percent = (p: number | undefined) =>
  Math.round(Math.min(1, Math.max(0, Number.isFinite(p) ? (p as number) : 0)) * 100);

type Texts = Pick<EngineView, 'headline' | 'detail' | 'canDownload' | 'enableSteps'>;

function unavailable(reason: EngineStatus['reason']): Texts {
  switch (reason) {
    case 'not-desktop-chrome':
      return {
        headline: 'On-device AI needs desktop Chrome. ConformUI uses the cloud here, after you allow it per project.',
        detail: 'Cloud use is asked for each project.',
        canDownload: false,
      };
    case 'chrome-too-old':
      return {
        headline: 'Update Chrome to 139 or later',
        detail: 'Older versions have no on-device model.',
        canDownload: false,
      };
    case 'no-prompt-api':
    case 'image-flag-off':
      return {
        headline: 'On-device AI is switched off in Chrome',
        detail: 'Turn on the Chrome flags below, relaunch, then download the model.',
        canDownload: false,
        enableSteps: [...ENABLE_STEPS],
      };
    case 'hardware':
      return {
        headline: "Chrome reports this device can't run the model",
        detail: 'Use the cloud, after you allow it per project.',
        canDownload: false,
      };
    default:
      return {
        headline: 'On-device AI is not available here',
        detail: 'Use the cloud, after you allow it per project.',
        canDownload: false,
      };
  }
}

function texts(s: EngineStatus): Texts {
  switch (s.device) {
    case 'available':
      return {
        headline: 'On-device model ready. First pass stays on this device.',
        detail:
          s.deviceImage === 'unknown' ? 'Image input: not checked' : `Image input: ${s.deviceImage ? 'on' : 'off'}`,
        canDownload: false,
      };
    case 'downloadable':
      return {
        headline: 'On-device model not downloaded',
        detail: 'Download it once to keep the first pass on this device.',
        canDownload: true,
      };
    case 'downloading':
      return {
        headline: `Downloading ${percent(s.downloadProgress)}%`,
        detail: 'You can use the cloud meanwhile, with your consent',
        canDownload: false,
      };
    case 'unavailable':
      return unavailable(s.reason);
  }
}

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
    ...texts(s),
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
