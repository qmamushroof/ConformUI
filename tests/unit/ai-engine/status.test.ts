import { CuiError, DEFAULT_RUNTIME_VALUES, type EngineStatus, type RuntimeValues } from '@kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ getAI: vi.fn(), getGenerativeModel: vi.fn() }));
vi.mock('firebase/ai', async (orig) => ({
  ...(await orig<typeof import('firebase/ai')>()),
  GoogleAIBackend: vi.fn(function (this: { kind: string }) {
    this.kind = 'google';
  }),
  InferenceMode: {
    PREFER_ON_DEVICE: 'prefer_on_device',
    ONLY_ON_DEVICE: 'only_on_device',
    ONLY_IN_CLOUD: 'only_in_cloud',
    PREFER_IN_CLOUD: 'prefer_in_cloud',
  },
  InferenceSource: { ON_DEVICE: 'on_device', IN_CLOUD: 'in_cloud' },
  getAI: sdk.getAI,
  getGenerativeModel: sdk.getGenerativeModel,
}));

import type { FirebaseApp } from '@fb';
import { AIError } from 'firebase/ai';
import { createAiEngine } from '../../../src/platform/ai-engine';
import { createModelFactory } from '../../../src/platform/ai-engine/model-factory';
import { createDeviceService } from '../../../src/platform/ai-engine/status';

const app = { name: 'app' } as FirebaseApp;
let values: RuntimeValues;
const config = { get: () => values, refresh: async () => {} };
let nowMs = 0;
const clock = { now: () => nowMs };

type Avail = 'available' | 'downloadable' | 'downloading' | 'unavailable' | Error;
let textAvail: Avail;
let imageAvail: Avail;
let availability: ReturnType<typeof vi.fn>;
let online = true;

function stubChrome(over: { mobile?: boolean; brands?: string[]; major?: string } = {}) {
  const brands = (over.brands ?? ['Chromium', 'Google Chrome']).map((brand) => ({
    brand,
    version: over.major ?? '158',
  }));
  vi.stubGlobal('navigator', {
    get onLine() {
      return online;
    },
    userAgent: 'Mozilla/5.0',
    userAgentData: { mobile: over.mobile ?? false, brands },
  });
}

function stubLanguageModel() {
  availability = vi.fn(async (opts?: { expectedInputs?: { type: string }[] }) => {
    const wantsImage = opts?.expectedInputs?.some((i) => i.type === 'image') ?? false;
    const v = wantsImage ? imageAvail : textAvail;
    if (v instanceof Error) throw v;
    return v;
  });
  vi.stubGlobal('LanguageModel', { availability });
}

let initialize: ReturnType<typeof vi.fn>;
const makeService = () => {
  const factory = createModelFactory({ app, config });
  return { factory, svc: createDeviceService({ config, clock, factory, online: () => online }) };
};

beforeEach(() => {
  values = { ...DEFAULT_RUNTIME_VALUES };
  nowMs = 0;
  online = true;
  textAvail = 'available';
  imageAvail = 'available';
  stubChrome();
  stubLanguageModel();
  initialize = vi.fn().mockResolvedValue(undefined);
  sdk.getAI.mockReset().mockReturnValue({});
  sdk.getGenerativeModel.mockReset().mockImplementation(() => ({ initializeDeviceModel: initialize }));
});
afterEach(() => vi.unstubAllGlobals());

describe('SPEC-AI-07 status mapping', () => {
  it('SPEC-AI-07, A1: flags on (observed text + image available) -> available, deviceImage true, online, cloud enabled', async () => {
    const s = await makeService().svc.status();
    expect(s).toEqual({ device: 'available', deviceImage: true, online: true, cloud: 'enabled' });
  });

  it('SPEC-AI-07, A1: multimodal flag off (observed image unavailable, text available) -> deviceImage false, image-flag-off', async () => {
    imageAvail = 'unavailable';
    const s = await makeService().svc.status();
    expect(s).toMatchObject({ device: 'available', deviceImage: false, reason: 'image-flag-off' });
  });

  it.each(['downloadable', 'downloading'] as const)(
    'SPEC-AI-07: text %s -> device %s, image availability drives deviceImage',
    async (v) => {
      textAvail = v;
      imageAvail = v;
      const s = await makeService().svc.status();
      expect(s).toMatchObject({ device: v, deviceImage: true });
      expect(s.reason).toBeUndefined();
    },
  );

  it('SPEC-AI-07: text downloadable with image unavailable -> deviceImage false and image-flag-off', async () => {
    textAvail = 'downloadable';
    imageAvail = 'unavailable';
    expect(await makeService().svc.status()).toMatchObject({
      device: 'downloadable',
      deviceImage: false,
      reason: 'image-flag-off',
    });
  });

  it('SPEC-AI-07: text unavailable -> device unavailable, reason hardware, deviceImage false', async () => {
    textAvail = 'unavailable';
    imageAvail = 'unavailable';
    expect(await makeService().svc.status()).toMatchObject({
      device: 'unavailable',
      deviceImage: false,
      reason: 'hardware',
    });
  });

  it('SPEC-AI-07: text availability throws -> unavailable with reason unknown', async () => {
    textAvail = new Error('boom');
    expect(await makeService().svc.status()).toMatchObject({ device: 'unavailable', reason: 'unknown' });
  });

  it('SPEC-AI-07: image availability throws -> deviceImage unknown, device still mapped from text', async () => {
    imageAvail = new Error('boom');
    expect(await makeService().svc.status()).toMatchObject({ device: 'available', deviceImage: 'unknown' });
  });

  it('SPEC-AI-07: an unrecognised availability value -> unavailable with reason unknown', async () => {
    textAvail = 'weird' as never;
    expect(await makeService().svc.status()).toMatchObject({ device: 'unavailable', reason: 'unknown' });
  });

  it('SPEC-AI-07: missing LanguageModel -> unavailable/no-prompt-api, availability never called', async () => {
    vi.stubGlobal('LanguageModel', undefined);
    expect(await makeService().svc.status()).toMatchObject({
      device: 'unavailable',
      deviceImage: false,
      reason: 'no-prompt-api',
    });
    expect(availability).not.toHaveBeenCalled();
  });

  it('SPEC-AI-07: text query asks for text in/out English; image query adds image input', async () => {
    await makeService().svc.status();
    const calls = availability.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
    expect(calls).toContainEqual({
      expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
  });

  it('SPEC-AI-07: mobile -> not-desktop-chrome', async () => {
    stubChrome({ mobile: true });
    expect(await makeService().svc.status()).toMatchObject({ device: 'unavailable', reason: 'not-desktop-chrome' });
  });

  it('SPEC-AI-07: no Chrome brand -> not-desktop-chrome', async () => {
    stubChrome({ brands: ['Chromium', 'Other'] });
    expect(await makeService().svc.status()).toMatchObject({ device: 'unavailable', reason: 'not-desktop-chrome' });
  });

  it('SPEC-AI-07: no navigator at all -> not-desktop-chrome', async () => {
    vi.stubGlobal('navigator', undefined);
    expect(await makeService().svc.status()).toMatchObject({ device: 'unavailable', reason: 'not-desktop-chrome' });
  });

  it.each([
    ['138', 'chrome-too-old'],
    ['139', undefined],
  ])('SPEC-AI-07: Chrome %s -> reason %s', async (major, reason) => {
    stubChrome({ major });
    const s = await makeService().svc.status();
    expect(s.reason).toBe(reason);
    if (reason) expect(s.device).toBe('unavailable');
  });

  it('SPEC-AI-07: falls back to the user agent string when userAgentData is missing', async () => {
    vi.stubGlobal('navigator', {
      onLine: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    });
    expect(await makeService().svc.status()).toMatchObject({ device: 'unavailable', reason: 'chrome-too-old' });
  });

  it('SPEC-AI-07: online follows connectivity and cloud follows cloud_enabled, both read fresh', async () => {
    const { svc } = makeService();
    await svc.status();
    online = false;
    values = { ...values, cloud_enabled: false };
    expect(await svc.status()).toMatchObject({ online: false, cloud: 'disabled', device: 'available' });
  });

  it('SPEC-AI-07: offline device facts are unchanged (device status never needs the network)', async () => {
    online = false;
    expect(await makeService().svc.status()).toMatchObject({ online: false, device: 'available', deviceImage: true });
  });
});

describe('SPEC-AI-07 status caching', () => {
  it('SPEC-AI-07: repeated calls within the TTL read the device once; after it, again', async () => {
    const { svc } = makeService();
    await svc.status();
    const n = availability.mock.calls.length;
    await svc.status();
    expect(availability.mock.calls.length).toBe(n);
    nowMs = 5_000;
    await svc.status();
    expect(availability.mock.calls.length).toBeGreaterThan(n);
  });

  it('SPEC-AI-07: concurrent calls share one device read', async () => {
    const { svc } = makeService();
    await Promise.all([svc.status(), svc.status(), svc.status()]);
    expect(availability.mock.calls.length).toBe(2);
  });

  it('SPEC-AI-07: refresh() bypasses the cache', async () => {
    const { svc } = makeService();
    await svc.status();
    textAvail = 'downloadable';
    expect((await svc.status()).device).toBe('available');
    expect((await svc.refresh()).device).toBe('downloadable');
  });

  it('SPEC-AI-07: a failed read is not cached past the TTL', async () => {
    const { svc } = makeService();
    textAvail = new Error('x');
    expect((await svc.status()).device).toBe('unavailable');
    textAvail = 'available';
    nowMs = 5_000;
    expect((await svc.status()).device).toBe('available');
  });
});

describe('SPEC-AI-03, SPEC-AI-07 downloadDeviceModel', () => {
  beforeEach(() => {
    textAvail = 'downloadable';
    imageAvail = 'downloadable';
  });

  it('SPEC-AI-03: builds an ONLY_ON_DEVICE model with text + image when deviceImage is true', async () => {
    const { svc } = makeService();
    await svc.download(() => {});
    expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(1);
    const params = sdk.getGenerativeModel.mock.calls[0]?.[1];
    expect(params.mode).toBe('only_on_device');
    expect(params.onDeviceParams.createOptions.expectedInputs).toEqual([
      { type: 'text', languages: ['en'] },
      { type: 'image' },
    ]);
  });

  it('SPEC-AI-07: expectedInputs are text-only when deviceImage is false', async () => {
    imageAvail = 'unavailable';
    await makeService().svc.download(() => {});
    const inputs = sdk.getGenerativeModel.mock.calls[0]?.[1].onDeviceParams.createOptions.expectedInputs;
    expect(inputs).toEqual([{ type: 'text', languages: ['en'] }]);
  });

  it('SPEC-AI-07: unknown image state also downloads text-only', async () => {
    imageAvail = new Error('x');
    await makeService().svc.download(() => {});
    const inputs = sdk.getGenerativeModel.mock.calls[0]?.[1].onDeviceParams.createOptions.expectedInputs;
    expect(inputs).toEqual([{ type: 'text', languages: ['en'] }]);
  });

  it('SPEC-AI-03: the downloaded instance is the factory instance; a repeat download reuses it', async () => {
    const { svc, factory } = makeService();
    await svc.download(() => {});
    await svc.download(() => {});
    expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(1);
    const built = factory.get(svc.downloadSpec(true));
    expect(built.model).toBe(sdk.getGenerativeModel.mock.results[0]?.value);
    expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(1);
  });

  it('SPEC-AI-07: progress passes through clamped to 0..1, non-finite ignored, 0.9 plateau preserved', async () => {
    const seen: number[] = [];
    initialize.mockImplementation(async (cb: (n: number) => void) => {
      for (const p of [0, 0.5, 0.9, 0.9, 0.9, -1, 2, Number.NaN, 1]) cb(p);
    });
    await makeService().svc.download((p) => seen.push(p));
    expect(seen).toEqual([0, 0.5, 0.9, 0.9, 0.9, 0, 1, 1]);
  });

  it('SPEC-AI-07: a throwing onProgress does not break the download', async () => {
    initialize.mockImplementation(async (cb: (n: number) => void) => cb(0.5));
    const s = await makeService().svc.download(() => {
      throw new Error('ui bug');
    });
    expect(s.device).toBeDefined();
  });

  it('SPEC-AI-07: while downloading, status() reports the latest downloadProgress; cleared afterwards', async () => {
    textAvail = 'downloading';
    imageAvail = 'downloading';
    const { svc } = makeService();
    let release!: () => void;
    initialize.mockImplementation(
      (cb: (n: number) => void) =>
        new Promise<void>((res) => {
          cb(0.9);
          release = res;
        }),
    );
    const d = svc.download(() => {});
    await vi.waitFor(() => expect(initialize).toHaveBeenCalled());
    nowMs = 10_000;
    expect(await svc.status()).toMatchObject({ device: 'downloading', downloadProgress: 0.9 });
    textAvail = 'available';
    imageAvail = 'available';
    release();
    const done = await d;
    expect(done).toMatchObject({ device: 'available', deviceImage: true });
    expect(done.downloadProgress).toBeUndefined();
  });

  it('SPEC-AI-07: cache is invalidated after a download, so the fresh status is returned', async () => {
    const { svc } = makeService();
    expect((await svc.status()).device).toBe('downloadable');
    textAvail = 'available';
    imageAvail = 'available';
    const s = await svc.download(() => {});
    expect(s.device).toBe('available');
    expect((await svc.status()).device).toBe('available');
  });

  it('SPEC-AI-07: concurrent downloads share one SDK call and both get progress', async () => {
    const a: number[] = [];
    const b: number[] = [];
    let cb!: (n: number) => void;
    let release!: () => void;
    initialize.mockImplementation(
      (c: (n: number) => void) =>
        new Promise<void>((res) => {
          cb = c;
          release = res;
        }),
    );
    const { svc } = makeService();
    const p1 = svc.download((p) => a.push(p));
    const p2 = svc.download((p) => b.push(p));
    await vi.waitFor(() => expect(initialize).toHaveBeenCalled());
    cb(0.4);
    release();
    await Promise.all([p1, p2]);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(a).toEqual([0.4]);
    expect(b).toEqual([0.4]);
  });

  it('SPEC-SET-03: already available -> no SDK download, status returned', async () => {
    textAvail = 'available';
    imageAvail = 'available';
    const s = await makeService().svc.download(() => {});
    expect(s.device).toBe('available');
    expect(initialize).not.toHaveBeenCalled();
  });

  it.each([
    ['no-prompt-api', () => vi.stubGlobal('LanguageModel', undefined)],
    [
      'hardware',
      () => {
        textAvail = 'unavailable';
      },
    ],
  ])('SPEC-SET-03: device unavailable (%s) -> DEVICE_UNAVAILABLE without calling the SDK', async (_n, arrange) => {
    arrange();
    await expect(makeService().svc.download(() => {})).rejects.toMatchObject({ code: 'DEVICE_UNAVAILABLE' });
    expect(initialize).not.toHaveBeenCalled();
  });

  it.each([
    ['api-not-enabled AIError', new AIError('api-not-enabled' as never, 'raw sdk text')],
    ['AbortError (cancelled)', Object.assign(new Error('raw sdk text'), { name: 'AbortError' })],
    ['NotAllowedError (no user activation)', Object.assign(new Error('raw sdk text'), { name: 'NotAllowedError' })],
    ['generic failure', new Error('raw sdk text')],
  ])('SPEC-SET-03, SPEC-AI-10: %s -> DEVICE_UNAVAILABLE, raw text never forwarded', async (_n, err) => {
    initialize.mockRejectedValue(err);
    const e = await makeService()
      .svc.download(() => {})
      .catch((x) => x);
    expect(e).toBeInstanceOf(CuiError);
    expect(e.code).toBe('DEVICE_UNAVAILABLE');
    expect(e.message).not.toContain('raw sdk text');
  });

  it('SPEC-SET-03: after a failed download a retry starts a new SDK call', async () => {
    initialize.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined);
    const { svc } = makeService();
    await expect(svc.download(() => {})).rejects.toBeInstanceOf(CuiError);
    await svc.download(() => {});
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it('SPEC-SEC-04: no console output on the failure path', async () => {
    const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((k) => vi.spyOn(console, k));
    initialize.mockRejectedValue(new Error('x'));
    await makeService()
      .svc.download(() => {})
      .catch(() => {});
    for (const s of spies) {
      expect(s).not.toHaveBeenCalled();
      s.mockRestore();
    }
  });
});

describe('createAiEngine status wiring', () => {
  it('SPEC-AI-07: engine.status() is real and engine.downloadDeviceModel resolves a status', async () => {
    textAvail = 'downloadable';
    imageAvail = 'downloadable';
    const engine = createAiEngine({ app, config, clock });
    const s: EngineStatus = await engine.status();
    expect(s.device).toBe('downloadable');
    const p: number[] = [];
    initialize.mockImplementation(async (cb: (n: number) => void) => {
      cb(1);
      textAvail = 'available';
      imageAvail = 'available';
    });
    expect((await engine.downloadDeviceModel((x) => p.push(x))).device).toBe('available');
    expect(p).toEqual([1]);
  });

  it('SPEC-AI-03: the runner and downloadDeviceModel share one factory (one SDK instance per spec)', async () => {
    textAvail = 'downloadable';
    imageAvail = 'downloadable';
    const engine = createAiEngine({ app, config, clock });
    await engine.downloadDeviceModel(() => {});
    await engine.downloadDeviceModel(() => {});
    expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(1);
    expect(sdk.getAI).toHaveBeenCalledTimes(1);
  });
});
