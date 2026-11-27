import type { ErrorCode } from '@kernel';
import type { NoticeCopy } from '@projects';

// All user-facing copy lives here (lane C, task 13.x). No em dash in any string (SPEC-UI-07).

const IMAGE_LIMITS = 'Use PNG, JPEG or WebP up to 20 MB and 8192 px per side.';
const IMAGE_HINT = 'Nothing else changed. For a long page, export the first screen or crop it into parts.';
const CLOUD_LIMIT = 'Cloud limit reached. Your results are kept; try again later.';
const CLOUD_UNREACHABLE = "Couldn't reach the cloud model. Nothing was lost.";

/** Non-error states and shell screens that share the `StateNotice` shape (SPEC-UI-05, SPEC-APP-03, SPEC-APP-06). */
export type NoticeReason = 'NO_PROJECTS' | 'NO_DESIGN' | 'NOT_FOUND' | 'ROUTE_ERROR' | 'CONFIG_ERROR';

export const copy = {
  appName: 'ConformUI',
  /** SPEC-APP-02 */
  header: {
    nav: ['Projects', 'Snippet', 'Settings'],
    engine: {
      onDevice: 'On-device ready',
      cloud: 'Cloud with consent',
      measured: 'Measured only',
      notDownloaded: 'Model not downloaded',
      downloading: (percent: number) => `Downloading ${percent}%`,
      deviceOff: 'On-device off',
    },
    offline: 'Offline',
  },
  /** SPEC-SET-06 */
  privacyCounter: {
    idle: 'Nothing has left this device',
    projectIdle: 'Nothing from this project has left this device',
  },
  /** SPEC-PWA-05 */
  update: {
    message: 'A new version is ready.',
    action: 'Reload',
  },
  /** SPEC-APP-03 */
  routeError: {
    back: 'Back to Projects',
  },
  /** SPEC-DEEP-04: why Deep Analysis is disabled, by `DeepAvailability` reason. */
  deepReason: {
    offline: 'Deep Analysis needs a connection; your results are kept.',
    'cloud-disabled': 'Cloud analysis is paused.',
    'daily-cap': 'Daily limit reached. Try tomorrow.',
    'nothing-to-refine': 'Nothing needs a deeper look.',
    'mode-on-device-only': 'Deep Analysis is off in on-device-only mode.',
  },
  /** Cross-feature flows (ROADMAP 7.3). */
  flows: {
    sampleName: 'Sample landing page',
    sampleBusy: 'Preparing the sample',
    copied: { fixPrompt: 'Fix prompt copied', text: 'Copied' },
    copyFailed: "Couldn't copy. Select the text and copy it.",
    downloaded: (name: string) => `Downloaded ${name}`,
    reverify: {
      title: (version: number) => `Re-verify against Contract v${version}`,
      lead: (n: number) => `Add the new captures your agent produced. The same ${n} requirements are checked again.`,
      sampleHint: "Use the sample's fixed captures, or drop your own: PNG, JPEG or WebP up to 20 MB.",
      go: 'Run Re-verify',
      unchanged: (n: number) => `Add new captures first. These are the captures Run ${n} already checked.`,
      noCapture: 'No capture yet',
      replace: (vp: string) => `Replace ${vp} capture`,
    },
    consent: {
      extract: 'Reading the design needs a cloud model, because this device cannot do it.',
      run: 'Judging the visual items needs a cloud model, because this device cannot do it.',
    },
    deep: {
      showPrecomputed: 'Show pre-computed result',
      failed: 'Deep Analysis did not finish. Your results are kept.',
      running: 'Deep Analysis is running',
      runningDetail: 'The cloud is reviewing the findings that need a closer look. This can take up to a minute.',
      refined: (n: number) => `Deep Analysis refined ${n} ${n === 1 ? 'finding' : 'findings'}`,
      refinedDetail: 'They are labelled Refined by Cloud, and the trace has a Cloud step.',
      nothing: 'Deep Analysis finished: nothing to refine',
      nothingDetail: 'The cloud agreed with the checks above, so no finding changed.',
    },
    runFailed: 'The run did not finish. Your captures and contract are kept.',
    project: {
      noRuns: (n: number) => `No runs yet. Run checks the ${n} requirements against both captures.`,
      noRunsEarly: 'No runs yet. Add a design, extract the contract, then add captures.',
      needCapture: 'Add a capture to run the checks.',
      needContract: 'Extract the contract first.',
    },
  },
  /** PRD §6 privacy statement, plain language (SPEC-SET-08). */
  privacy: {
    stored: 'Projects, images, contracts and runs, on this device only. Delete one project or everything.',
    sent: "Nothing, unless you run Deep Analysis or allow cloud for a project. Then the listed images, contract and measurements go to Google's Gemini through Firebase. You see the list and its size before anything leaves.",
    domSnippet:
      'Runs only on a page you open. It reads that page and copies JSON to your clipboard. It sends nothing anywhere.',
    appCheck: 'Cloud requests carry an attestation token to prevent abuse. It contains no project content.',
    analytics: 'None.',
  },
} as const;

/** SPEC-UI-05: one `StateNotice`, copy keyed by `ErrorCode` or reason. */
export const stateCopy: Record<ErrorCode | NoticeReason, NoticeCopy> = {
  NO_PROJECTS: {
    tone: 'neutral',
    title: 'Check a page against its design: build a contract, run it, hand the fixes to your coding agent.',
  },
  NO_DESIGN: {
    tone: 'neutral',
    title: 'Add a design image (PNG, JPEG or WebP, up to 20 MB). From a design tool, export the frame as PNG.',
  },
  NOT_FOUND: {
    tone: 'neutral',
    title: "This page doesn't exist.",
    detail: 'The link may point to a run or project that was deleted on this device.',
    action: 'Back to Projects',
  },
  ROUTE_ERROR: {
    tone: 'danger',
    title: 'Something went wrong on this screen. Your projects are safe on this device.',
    detail:
      'Reload to open the screen again. If it keeps happening, copy the code and include it when you report the problem.',
    action: 'Reload',
  },
  CONFIG_ERROR: {
    tone: 'danger',
    title: 'Configuration error',
    detail: 'This build is missing required settings. Measured and visual checks and the sample still work.',
  },

  IMAGE_UNSUPPORTED: { tone: 'danger', title: IMAGE_LIMITS, detail: IMAGE_HINT },
  IMAGE_TOO_LARGE: { tone: 'danger', title: IMAGE_LIMITS, detail: IMAGE_HINT },
  IMAGE_DECODE_FAILED: {
    tone: 'danger',
    title: 'That image could not be read.',
    detail: `Nothing else changed. ${IMAGE_LIMITS}`,
  },
  SNAPSHOT_INVALID: {
    tone: 'danger',
    title: 'The DOM snapshot was not added.',
    detail: 'The run will use images only.',
  },
  SNAPSHOT_TOO_LARGE: {
    tone: 'danger',
    title: 'The DOM snapshot is too large (over 1 MB or 1500 elements).',
    detail: 'The run will use images only.',
  },
  DEVICE_UNAVAILABLE: {
    tone: 'info',
    title: 'On-device AI is not available here.',
    detail: 'Use the cloud for this project after you allow it, or write the requirements yourself.',
    action: 'Use cloud for this project',
  },
  DEVICE_DOWNLOADING: {
    tone: 'info',
    title: 'The on-device model is still downloading.',
    detail: 'You can use the cloud meanwhile, with your consent.',
    action: 'Use cloud for this project',
  },
  DEVICE_NO_IMAGE: {
    tone: 'info',
    title: 'On-device image input is off.',
    detail: 'Turn it on in Settings, use the cloud for this project, or write the requirements yourself.',
    action: 'Use cloud for this project',
  },
  OFFLINE: {
    tone: 'info',
    title: "You're offline. Measured and Visual checks still run; AI checks and Deep Analysis wait for a connection.",
  },
  CLOUD_DISABLED: {
    tone: 'info',
    title: 'Cloud analysis is paused.',
    detail: 'Measured and Visual checks still run on this device.',
  },
  QUOTA_EXCEEDED: { tone: 'danger', title: CLOUD_LIMIT },
  DAILY_CAP: { tone: 'danger', title: CLOUD_LIMIT },
  APPCHECK_FAILED: { tone: 'danger', title: CLOUD_UNREACHABLE, action: 'Try again' },
  AI_NOT_ENABLED: {
    tone: 'danger',
    title: 'Cloud analysis is not set up yet.',
    detail: 'Enable Firebase AI Logic in the console.',
  },
  AI_BAD_OUTPUT: {
    tone: 'danger',
    title: "Needs review: the model's answer could not be read.",
    action: 'Try again',
  },
  AI_BLOCKED: { tone: 'danger', title: 'The model did not answer this request. Nothing was lost.' },
  AI_FAILED: { tone: 'danger', title: CLOUD_UNREACHABLE, action: 'Try again' },
  CONSENT_REQUIRED: { tone: 'danger', title: 'Cloud use needs your permission first. Nothing was sent.' },
  CONTRACT_LOCKED: {
    tone: 'info',
    title: 'This contract is locked by a run. Editing creates a new version.',
  },
  STORAGE_FAILED: {
    tone: 'danger',
    title: "Couldn't save to local storage. Your last change may not be kept.",
    action: 'Try again',
  },
  STORAGE_UNAVAILABLE: {
    tone: 'danger',
    title: "Couldn't open local storage. Nothing was deleted.",
    detail:
      "The browser blocked access to this site's data, which can happen in private windows or when storage is full. Reload to try again.",
    action: 'Reload',
  },
};

/** SPEC-UI-05: reason shown on a requirement whose viewport has no capture. */
export const noCaptureReason = (viewportLabel: string): string => `Not checked: no capture for ${viewportLabel}`;
