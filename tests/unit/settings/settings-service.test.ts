import { type AiEngine, CuiError, type EngineStatus, type Project } from '@kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import { consentList, createSettingsService, type SettingsService } from '../../../src/features/settings';
import { fixedClock } from '../../helpers/clock-ids';
import { InMemoryProjectStore, InMemorySettingsStore } from '../../helpers/memory-stores';

const status = (s: Partial<EngineStatus> = {}): EngineStatus => ({
  device: 'available',
  deviceImage: true,
  online: true,
  cloud: 'enabled',
  ...s,
});

class StubAi implements AiEngine {
  downloads = 0;
  runs = 0;
  fail?: unknown;
  constructor(public current: EngineStatus) {}
  async status() {
    return this.current;
  }
  async downloadDeviceModel(onProgress: (p: number) => void) {
    this.downloads++;
    if (this.fail) throw this.fail;
    onProgress(0.5);
    onProgress(1);
    this.current = status();
    return this.current;
  }
  async run(): Promise<never> {
    this.runs++;
    throw new Error('unused');
  }
}

const project = (id: string, extra: Partial<Project> = {}): Project => ({
  id,
  name: id,
  createdAt: 1,
  updatedAt: 1,
  isSample: false,
  designs: [],
  captures: [],
  cloudUsage: { requests: 0, bytes: 0 },
  ...extra,
});

let ai: StubAi;
let settings: InMemorySettingsStore;
let projects: InMemoryProjectStore;
let svc: SettingsService;

const make = (s: EngineStatus = status()) => {
  ai = new StubAi(s);
  svc = createSettingsService({ store: settings, ai, projects, clock: fixedClock() });
};

beforeEach(() => {
  settings = new InMemorySettingsStore();
  projects = new InMemoryProjectStore();
  make();
});

describe('read, setMode, markOnboarded', () => {
  it('SPEC-SET-04, PRD-F-11.3: read returns defaults; setMode persists each mode', async () => {
    expect((await svc.read()).mode).toBe('auto');
    await svc.setMode('cloud-only');
    expect((await svc.read()).mode).toBe('cloud-only');
    await svc.setMode('on-device-only');
    expect((await svc.read()).mode).toBe('on-device-only');
  });

  it('SPEC-SET-04: an unknown mode is rejected and nothing is written', async () => {
    await expect(svc.setMode('turbo' as never)).rejects.toThrow();
    expect((await svc.read()).mode).toBe('auto');
  });

  it('SPEC-SET-08, PRD-F-12.2: markOnboarded sets the flag and is idempotent', async () => {
    await svc.markOnboarded();
    await svc.markOnboarded();
    expect((await svc.read()).onboarded).toBe(true);
  });

  it('SPEC-SET-04: setMode leaves other settings untouched', async () => {
    await settings.write({ deepUsage: { day: '2026-11-26', count: 2 }, everSentToCloud: true });
    await svc.setMode('cloud-only');
    const s = await svc.read();
    expect(s.deepUsage.count).toBe(2);
    expect(s.everSentToCloud).toBe(true);
  });
});

describe('engine() text per status', () => {
  it('SPEC-SET-01, PRD-F-11.1: available shows ready text and image input on', async () => {
    const v = await svc.engine();
    expect(v.device).toBe('available');
    expect(v.headline).toBe('On-device model ready. First pass stays on this device.');
    expect(v.detail).toBe('Image input: on');
    expect(v.canDownload).toBe(false);
    expect(v.enableSteps).toBeUndefined();
    expect(v.imageOnDevice).toBe(true);
    expect(v.mode).toBe('auto');
  });

  it('SPEC-SET-01: available with image input off or unknown', async () => {
    make(status({ deviceImage: false }));
    expect((await svc.engine()).detail).toBe('Image input: off');
    make(status({ deviceImage: 'unknown' }));
    const v = await svc.engine();
    expect(v.imageOnDevice).toBe('unknown');
    expect(v.detail).not.toMatch(/: on$/);
  });

  it('SPEC-SET-01, SPEC-SET-03: downloadable offers Download and never auto-downloads', async () => {
    make(status({ device: 'downloadable' }));
    const v = await svc.engine();
    expect(v.headline).toBe('On-device model not downloaded');
    expect(v.canDownload).toBe(true);
    expect(ai.downloads).toBe(0);
  });

  it('SPEC-SET-01: downloading shows NN% and the cloud hint; progress is clamped and rounded', async () => {
    make(status({ device: 'downloading', downloadProgress: 0.426 }));
    const v = await svc.engine();
    expect(v.headline).toBe('Downloading 43%');
    expect(v.detail).toBe('You can use the cloud meanwhile, with your consent');
    expect(v.canDownload).toBe(false);
    make(status({ device: 'downloading' }));
    expect((await svc.engine()).headline).toBe('Downloading 0%');
    make(status({ device: 'downloading', downloadProgress: 7 }));
    expect((await svc.engine()).headline).toBe('Downloading 100%');
    make(status({ device: 'downloading', downloadProgress: Number.NaN }));
    expect((await svc.engine()).headline).toBe('Downloading 0%');
  });

  it('SPEC-SET-01: unavailable not-desktop-chrome', async () => {
    make(status({ device: 'unavailable', reason: 'not-desktop-chrome' }));
    const v = await svc.engine();
    expect(v.headline).toBe(
      'On-device AI needs desktop Chrome. ConformUI uses the cloud here, after you allow it per project.',
    );
    expect(v.canDownload).toBe(false);
    expect(v.enableSteps).toBeUndefined();
  });

  it('SPEC-SET-01: unavailable chrome-too-old and hardware', async () => {
    make(status({ device: 'unavailable', reason: 'chrome-too-old' }));
    expect((await svc.engine()).headline).toBe('Update Chrome to 139 or later');
    make(status({ device: 'unavailable', reason: 'hardware' }));
    expect((await svc.engine()).headline).toBe("Chrome reports this device can't run the model");
  });

  it('SPEC-SET-01: unavailable with unknown or missing reason still gives non-empty text and no steps', async () => {
    make(status({ device: 'unavailable', reason: 'unknown' }));
    let v = await svc.engine();
    expect(v.headline.length).toBeGreaterThan(0);
    expect(v.enableSteps).toBeUndefined();
    make(status({ device: 'unavailable' }));
    v = await svc.engine();
    expect(v.headline.length).toBeGreaterThan(0);
    expect(v.canDownload).toBe(false);
  });

  it('SPEC-SET-01, SPEC-SET-02: no-prompt-api and image-flag-off show the enable steps', async () => {
    for (const reason of ['no-prompt-api', 'image-flag-off'] as const) {
      make(status({ device: 'unavailable', reason }));
      const v = await svc.engine();
      expect(v.enableSteps?.length).toBeGreaterThan(0);
      expect(v.canDownload).toBe(false);
    }
  });

  it('SPEC-SET-02: enable steps list both flags, enable, relaunch and download', async () => {
    make(status({ device: 'unavailable', reason: 'image-flag-off' }));
    const steps = (await svc.engine()).enableSteps ?? [];
    expect(steps.some((s) => s.includes('chrome://flags/#prompt-api-multimodal-input'))).toBe(true);
    expect(steps.some((s) => s.includes('chrome://flags/#gemma4-for-built-in-ai'))).toBe(true);
    expect(steps.some((s) => /Enabled/.test(s))).toBe(true);
    expect(steps.some((s) => /Relaunch Chrome/.test(s))).toBe(true);
    expect(steps[steps.length - 1]).toBe('Come back and press Download model');
  });

  it('SPEC-SET-01: reports online, cloud state and the current mode', async () => {
    await svc.setMode('cloud-only');
    ai.current = status({ online: false, cloud: 'disabled' });
    const v = await svc.engine();
    expect(v.online).toBe(false);
    expect(v.cloud).toBe('disabled');
    expect(v.mode).toBe('cloud-only');
  });
});

describe('downloadModel', () => {
  it('SPEC-SET-03, PRD-F-11.2: calls downloadDeviceModel once, forwards progress, returns the new view', async () => {
    make(status({ device: 'downloadable' }));
    const seen: number[] = [];
    const v = await svc.downloadModel((p) => seen.push(p));
    expect(ai.downloads).toBe(1);
    expect(ai.runs).toBe(0);
    expect(seen).toEqual([0.5, 1]);
    expect(v.device).toBe('available');
  });

  it('SPEC-SET-03: a failure becomes DEVICE_UNAVAILABLE and keeps the cause', async () => {
    make(status({ device: 'downloadable' }));
    const boom = new Error('network');
    ai.fail = boom;
    const e = await svc.downloadModel(() => undefined).catch((x) => x);
    expect(e).toBeInstanceOf(CuiError);
    expect(e.code).toBe('DEVICE_UNAVAILABLE');
    expect(e.cause).toBe(boom);
  });
});

describe('consent list', () => {
  it('SPEC-SET-05, PRD-F-11.3: lists only projects with cloud consent', () => {
    const list = consentList([
      project('a', { name: 'Alpha', cloudConsent: { grantedAt: 5 } }),
      project('b'),
      project('c', { name: 'Gamma', cloudConsent: { grantedAt: 9 } }),
    ]);
    expect(list).toEqual([
      { projectId: 'a', name: 'Alpha', grantedAt: 5 },
      { projectId: 'c', name: 'Gamma', grantedAt: 9 },
    ]);
    expect(consentList([])).toEqual([]);
  });
});

describe('clearAllData', () => {
  it('SPEC-SET-07, PRD-F-11.4: clears stores, keeps deepUsage, resets mode, onboarding and everSentToCloud', async () => {
    await projects.put(project('p1'));
    await settings.write({
      mode: 'cloud-only',
      onboarded: true,
      everSentToCloud: true,
      deepUsage: { day: '2026-11-26', count: 3 },
    });
    await svc.clearAllData();
    expect(await projects.list()).toEqual([]);
    expect(await svc.read()).toEqual({
      mode: 'auto',
      onboarded: false,
      everSentToCloud: false,
      deepUsage: { day: '2026-11-26', count: 3 },
    });
  });

  it('SPEC-SET-07: clearing an empty app works and is repeatable', async () => {
    await svc.clearAllData();
    await svc.clearAllData();
    expect((await svc.read()).deepUsage).toEqual({ day: '', count: 0 });
  });
});

describe('privacy', () => {
  it('SPEC-SET-06, PRD-F-11.5: no project shows nothing sent', () => {
    expect(svc.privacy()).toEqual({ kind: 'nothing-sent', text: 'Nothing has left this device' });
  });

  it('SPEC-SET-06: a project with no cloud requests says nothing from it has left the device', () => {
    expect(svc.privacy(project('p'))).toEqual({
      kind: 'sent',
      requests: 0,
      bytes: 0,
      text: 'Nothing from this project has left this device',
    });
  });

  it('SPEC-SET-06: counts requests and KB, singular and plural', () => {
    const one = svc.privacy(project('p', { cloudUsage: { requests: 1, bytes: 2048 } }));
    expect(one).toMatchObject({ kind: 'sent', requests: 1, bytes: 2048, text: 'Cloud: 1 request · 2 KB this project' });
    const many = svc.privacy(project('p', { cloudUsage: { requests: 3, bytes: 1536 } }));
    expect(many).toMatchObject({ text: 'Cloud: 3 requests · 1.5 KB this project' });
  });

  it('SPEC-SET-06: tiny byte counts never read as 0 KB', () => {
    const v = svc.privacy(project('p', { cloudUsage: { requests: 1, bytes: 10 } }));
    expect(v).toMatchObject({ text: 'Cloud: 1 request · 0.1 KB this project' });
  });
});
