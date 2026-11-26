import type { EngineStatus } from '@kernel';

// SPEC-SET-02: copy-paste steps; a page cannot open chrome:// links, so the user copies them.
const ENABLE_STEPS = [
  'Open chrome://flags/#prompt-api-multimodal-input',
  'Open chrome://flags/#gemma4-for-built-in-ai',
  'Set both to Enabled',
  'Relaunch Chrome',
  'Come back and press Download model',
];

export const percent = (p: number | undefined) =>
  Math.round(Math.min(1, Math.max(0, Number.isFinite(p) ? (p as number) : 0)) * 100);

export interface EngineTexts {
  headline: string;
  detail: string;
  canDownload: boolean;
  enableSteps?: string[];
}

function unavailable(reason: EngineStatus['reason']): EngineTexts {
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

export function engineTexts(s: EngineStatus): EngineTexts {
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
