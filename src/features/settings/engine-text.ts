import type { EngineStatus } from '@kernel';

// SPEC-SET-02: four copy-paste steps as in the prototype; a page cannot open chrome:// links, so the user copies them.
// The Gemma 4 flag (PRD-D-33) is added to steps 1 and 2 instead of becoming steps of their own.
const ENABLE_STEPS = [
  'Open chrome://flags/#prompt-api-multimodal-input and chrome://flags/#gemma4-for-built-in-ai',
  'Set both to Enabled',
  'Relaunch Chrome',
  'Come back and press Download model',
];

const FLAG_OFF = {
  headline: 'On-device image input is off',
  detail:
    'Chrome has the model, but image input is turned off, so it can’t read designs yet. Text-only steps still run here.',
};

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
        detail: 'This browser has no on-device model. Measured and Visual checks still run on this device.',
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
      return { ...FLAG_OFF, canDownload: false, enableSteps: [...ENABLE_STEPS] };
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
      if (s.deviceImage === false) return { ...FLAG_OFF, canDownload: false, enableSteps: [...ENABLE_STEPS] };
      return {
        headline: 'On-device model ready: first pass stays on this device',
        detail:
          'Gemma 4 in Chrome on this computer. Contract extraction and judged checks run here unless you choose otherwise.',
        canDownload: false,
      };
    case 'downloadable':
      return {
        headline: 'On-device model not downloaded',
        detail: 'Chrome can run Gemma 4 on this computer once the model is downloaded.',
        canDownload: true,
      };
    case 'downloading':
      return {
        headline: `Downloading ${percent(s.downloadProgress)}%`,
        detail: 'Chrome is downloading Gemma 4. You can keep working; the download continues in the background.',
        canDownload: false,
      };
    case 'unavailable':
      return unavailable(s.reason);
  }
}
