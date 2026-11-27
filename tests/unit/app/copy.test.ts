import { ERROR_CODES } from '@kernel';
import { describe, expect, it } from 'vitest';
import { copy, noCaptureReason, stateCopy } from '../../../src/app/copy';

const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];

describe('SPEC-UI-05: copy keyed by ErrorCode and reason', () => {
  it.each(ERROR_CODES)('SPEC-UI-05: %s has a title and a tone', (code) => {
    const n = stateCopy[code];
    expect(n.title.length).toBeGreaterThan(0);
    expect(['danger', 'info', 'neutral']).toContain(n.tone);
  });

  it.each(['NO_PROJECTS', 'NO_DESIGN', 'NOT_FOUND', 'ROUTE_ERROR', 'CONFIG_ERROR'] as const)(
    'SPEC-UI-05, SPEC-APP-03: reason %s has copy',
    (key) => {
      expect(stateCopy[key].title.length).toBeGreaterThan(0);
    },
  );

  it('SPEC-UI-05: exact §5.4 strings', () => {
    expect(stateCopy.NO_PROJECTS.title).toBe(
      'Check a page against its design: build a contract, run it, hand the fixes to your coding agent.',
    );
    expect(stateCopy.NO_DESIGN.title).toBe(
      'Add a design image (PNG, JPEG or WebP, up to 20 MB). From a design tool, export the frame as PNG.',
    );
    expect(noCaptureReason('Mobile')).toBe('Not checked: no capture for Mobile');
    expect(stateCopy.IMAGE_UNSUPPORTED.title).toBe('Use PNG, JPEG or WebP up to 20 MB and 8192 px per side.');
    expect(stateCopy.IMAGE_TOO_LARGE.title).toBe(stateCopy.IMAGE_UNSUPPORTED.title);
    expect(stateCopy.SNAPSHOT_INVALID.detail).toBe('The run will use images only.');
    expect(stateCopy.OFFLINE.title).toBe(
      "You're offline. Measured and Visual checks still run; AI checks and Deep Analysis wait for a connection.",
    );
    expect(stateCopy.QUOTA_EXCEEDED.title).toBe('Cloud limit reached. Your results are kept; try again later.');
    expect(stateCopy.DAILY_CAP.title).toBe(stateCopy.QUOTA_EXCEEDED.title);
    expect(stateCopy.AI_BAD_OUTPUT.title).toBe("Needs review: the model's answer could not be read.");
    expect(stateCopy.AI_FAILED.title).toBe("Couldn't reach the cloud model. Nothing was lost.");
    // An App Check refusal is not a network problem: it says so and offers a reload.
    expect(stateCopy.APPCHECK_FAILED.title).toBe("Couldn't verify this app with the cloud service. Nothing was lost.");
    expect(stateCopy.APPCHECK_FAILED.detail).toBe('Reload the page and try again. This try was not counted.');
    expect(stateCopy.APPCHECK_FAILED.action).toBe('Try again');
    expect(stateCopy.CLOUD_DISABLED.title).toBe('Cloud analysis is paused.');
    expect(stateCopy.STORAGE_UNAVAILABLE.title).toBe("Couldn't open local storage. Nothing was deleted.");
    expect(stateCopy.STORAGE_UNAVAILABLE.action).toBe('Reload');
  });

  it('SPEC-UI-05: AI_NOT_ENABLED names the console step (kernel table)', () => {
    expect(strings(stateCopy.AI_NOT_ENABLED).join(' ')).toContain('Enable Firebase AI Logic in the console');
  });

  it('SPEC-UI-05: device states offer the cloud path (Use cloud for this project)', () => {
    expect(stateCopy.DEVICE_UNAVAILABLE.action).toBe('Use cloud for this project');
  });
});

describe('SPEC-APP-02, SPEC-APP-03, SPEC-APP-06, SPEC-PWA-05: shell copy', () => {
  it('SPEC-APP-02: header pills', () => {
    expect(copy.appName).toBe('ConformUI');
    expect(copy.header.engine.onDevice).toBe('On-device ready');
    expect(copy.header.engine.cloud).toBe('Cloud with consent');
    expect(copy.header.engine.measured).toBe('Measured only');
    expect(copy.header.engine.notDownloaded).toBe('Model not downloaded');
    expect(copy.header.engine.downloading(42)).toBe('Downloading 42%');
    expect(copy.header.engine.deviceOff).toBe('On-device off');
    expect(copy.header.offline).toBe('Offline');
    expect(copy.header.nav).toEqual(['Projects', 'Snippet', 'Settings']);
  });

  it('SPEC-APP-06: Configuration error', () => {
    expect(stateCopy.CONFIG_ERROR.title).toBe('Configuration error');
  });

  it('SPEC-PWA-05: update toast', () => {
    expect(copy.update.message).toBe('A new version is ready.');
    expect(copy.update.action).toBe('Reload');
  });

  it('SPEC-APP-03: route error screen has Reload and Back to Projects', () => {
    expect(stateCopy.ROUTE_ERROR.action).toBe('Reload');
    expect(copy.routeError.back).toBe('Back to Projects');
  });

  it('SPEC-APP-03: not found screen', () => {
    expect(stateCopy.NOT_FOUND.title).toBe("This page doesn't exist.");
  });

  it('SPEC-SET-08, PRD §6: privacy statement covers all five topics, plain language', () => {
    expect(Object.keys(copy.privacy).sort()).toEqual(['analytics', 'appCheck', 'domSnippet', 'sent', 'stored']);
    expect(copy.privacy.analytics).toBe('None.');
    expect(copy.privacy.stored).toContain('on this device only');
    expect(copy.privacy.sent).toContain('Nothing, unless');
  });

  it('SPEC-SET-06: privacy counter idle text', () => {
    expect(copy.privacyCounter.idle).toBe('Nothing has left this device');
  });
});

describe('SPEC-UI-07: copy punctuation', () => {
  const all = [...strings(copy), ...strings(stateCopy)];

  it('SPEC-UI-07: collects a meaningful number of strings (guards an empty scan)', () => {
    expect(all.length).toBeGreaterThan(40);
  });

  it('SPEC-UI-07: no em dash (U+2014) in any copy string', () => {
    expect(all.filter((s) => s.includes('—'))).toEqual([]);
  });

  it('SPEC-UI-07: copy.ts source has no em dash', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/app/copy.ts', 'utf8').includes('—')).toBe(false);
  });

  it('SPEC-UI-07: no em dash in the component source of this task', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/features/projects/ui/state-notice.tsx', 'utf8').includes('—')).toBe(false);
  });

  it('PRD-D-15: copy names no build tooling', () => {
    expect(all.filter((s) => /\b(claude|cursor|copilot|chatgpt)\b/i.test(s))).toEqual([]);
  });
});
