import {
  type AiMode,
  type AiRequest,
  type AiTask,
  CuiError,
  DEFAULT_RUNTIME_VALUES,
  type EngineStatus,
  type ErrorCode,
  mintConsent,
  type RuntimeValues,
} from '@kernel';
import { AIError } from 'firebase/ai';
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
import { createAiEngine } from '../../../src/platform/ai-engine';
import { createRunner } from '../../../src/platform/ai-engine/run';

const app = { name: 'app' } as FirebaseApp;
let values: RuntimeValues;
const config = { get: () => values, refresh: async () => {} };
let nowMs = 0;
const clock = { now: () => nowMs };

const GOOD = { verdict: 'pass', confidence: 'high', explanation: 'Looks right.', suggestedFix: 'None needed.' };
const trusted = { isTrusted: true } as Event;
const project = mintConsent({ scope: 'project', projectId: 'p1' }, trusted);
const deep = mintConsent({ scope: 'deep', runId: 'r1' }, trusted);

const okStatus: EngineStatus = { device: 'available', deviceImage: true, online: true, cloud: 'enabled' };
let status: EngineStatus;
let online: boolean;

const img = { mime: 'image/png' as const, base64: 'AAAA', bytes: 3, role: 'pair' as const };
const req = (over: Partial<AiRequest> = {}): AiRequest => ({
  task: 'judge',
  mode: 'PREFER_ON_DEVICE',
  system: 'sys',
  user: 'Is it right?',
  images: [],
  promptVersion: 'v1',
  allowedNumbers: [],
  consent: project,
  ...over,
});

type Resp = {
  text?: () => string;
  inferenceSource?: string;
  candidates?: unknown[];
  promptFeedback?: { blockReason?: string };
};
const reply = (text: string, over: Resp = {}) => ({
  response: { text: () => text, inferenceSource: 'in_cloud', candidates: [{ finishReason: 'STOP' }], ...over },
});

let generate: ReturnType<typeof vi.fn>;
const runner = () => createRunner({ app, config, clock, status: async () => status, online: () => online });

const code = async (p: Promise<unknown>): Promise<ErrorCode> => {
  try {
    await p;
  } catch (e) {
    if (e instanceof CuiError) return e.code;
    throw e;
  }
  throw new Error('expected CuiError');
};

beforeEach(() => {
  values = { ...DEFAULT_RUNTIME_VALUES };
  status = { ...okStatus };
  online = true;
  nowMs = 0;
  generate = vi.fn().mockResolvedValue(reply(JSON.stringify(GOOD)));
  sdk.getAI.mockReset().mockReturnValue({});
  sdk.getGenerativeModel.mockReset().mockImplementation(() => ({ generateContent: generate }));
});
afterEach(() => vi.useRealTimers());

describe('SPEC-AI-02 guards (consent, device)', () => {
  const cloudModes: AiMode[] = ['PREFER_ON_DEVICE', 'ONLY_IN_CLOUD'];
  it.each(cloudModes)('SPEC-AI-02, S1: %s without consent -> CONSENT_REQUIRED, SDK never called', async (mode) => {
    expect(await code(runner().run(req({ mode, consent: undefined })))).toBe('CONSENT_REQUIRED');
    expect(sdk.getGenerativeModel).not.toHaveBeenCalled();
  });

  it('SPEC-AI-02: deep-analysis with project-scope consent -> CONSENT_REQUIRED; deep scope passes', async () => {
    const r = req({ task: 'deep-analysis', mode: 'ONLY_IN_CLOUD', consent: project });
    expect(await code(runner().run(r))).toBe('CONSENT_REQUIRED');
    generate.mockResolvedValue(reply(JSON.stringify({ items: [] })));
    const out = await runner().run({ ...r, consent: deep });
    expect(out.json).toEqual({ items: [] });
  });

  it('SPEC-AI-02: ONLY_ON_DEVICE needs no consent', async () => {
    generate.mockResolvedValue(reply(JSON.stringify(GOOD), { inferenceSource: 'on_device' }));
    const out = await runner().run(req({ mode: 'ONLY_ON_DEVICE', consent: undefined }));
    expect(out.engine).toBe('on-device');
    expect(out.bytesSent).toBe(0);
    expect(out.model).toBe('on-device');
    expect(out.requestedMode).toBe('ONLY_ON_DEVICE');
  });

  it('SPEC-AI-02 (b): ONLY_ON_DEVICE result from the cloud is discarded -> AI_FAILED', async () => {
    generate.mockResolvedValue(reply(JSON.stringify(GOOD), { inferenceSource: 'in_cloud' }));
    expect(await code(runner().run(req({ mode: 'ONLY_ON_DEVICE' })))).toBe('AI_FAILED');
  });

  it('SPEC-AI-02 (b), SPEC-AI-04: ONLY_ON_DEVICE with missing inferenceSource -> AI_FAILED', async () => {
    generate.mockResolvedValue(reply(JSON.stringify(GOOD), { inferenceSource: undefined }));
    expect(await code(runner().run(req({ mode: 'ONLY_ON_DEVICE' })))).toBe('AI_FAILED');
  });

  it.each([
    ['downloadable', 'DEVICE_UNAVAILABLE'],
    ['unavailable', 'DEVICE_UNAVAILABLE'],
    ['downloading', 'DEVICE_DOWNLOADING'],
  ] as const)('SPEC-AI-02 (c): ONLY_ON_DEVICE with device %s -> %s, no SDK call', async (device, expected) => {
    status = { ...okStatus, device };
    expect(await code(runner().run(req({ mode: 'ONLY_ON_DEVICE' })))).toBe(expected);
    expect(generate).not.toHaveBeenCalled();
  });

  it('SPEC-AI-02, SPEC-AI-11: ONLY_ON_DEVICE with an image while deviceImage is not true -> DEVICE_NO_IMAGE', async () => {
    for (const deviceImage of [false, 'unknown'] as const) {
      status = { ...okStatus, deviceImage };
      expect(await code(runner().run(req({ mode: 'ONLY_ON_DEVICE', images: [img] })))).toBe('DEVICE_NO_IMAGE');
    }
    expect(generate).not.toHaveBeenCalled();
  });

  it('SPEC-AI-02: ONLY_ON_DEVICE text-only is fine when deviceImage is false', async () => {
    status = { ...okStatus, deviceImage: false };
    generate.mockResolvedValue(reply(JSON.stringify(GOOD), { inferenceSource: 'on_device' }));
    await expect(runner().run(req({ mode: 'ONLY_ON_DEVICE' }))).resolves.toBeDefined();
  });

  it('SPEC-AI-02: an already aborted signal -> AI_FAILED before any SDK call', async () => {
    const c = new AbortController();
    c.abort();
    expect(await code(runner().run(req(), c.signal))).toBe('AI_FAILED');
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('SPEC-AI-09 pre-call checks', () => {
  it('SPEC-AI-09: cloud_enabled=false -> CLOUD_DISABLED for cloud-capable modes, not for ONLY_ON_DEVICE', async () => {
    values = { ...DEFAULT_RUNTIME_VALUES, cloud_enabled: false };
    for (const mode of ['PREFER_ON_DEVICE', 'ONLY_IN_CLOUD'] as const) {
      expect(await code(runner().run(req({ mode })))).toBe('CLOUD_DISABLED');
    }
    expect(generate).not.toHaveBeenCalled();
    generate.mockResolvedValue(reply(JSON.stringify(GOOD), { inferenceSource: 'on_device' }));
    await expect(runner().run(req({ mode: 'ONLY_ON_DEVICE' }))).resolves.toBeDefined();
  });

  it('SPEC-AI-09: offline + ONLY_IN_CLOUD -> OFFLINE', async () => {
    online = false;
    expect(await code(runner().run(req({ mode: 'ONLY_IN_CLOUD' })))).toBe('OFFLINE');
    expect(generate).not.toHaveBeenCalled();
  });

  it('SPEC-AI-09: offline + PREFER_ON_DEVICE with a usable device still runs; with no usable device -> OFFLINE', async () => {
    online = false;
    status = { ...okStatus, online: false };
    generate.mockResolvedValue(reply(JSON.stringify(GOOD), { inferenceSource: 'on_device' }));
    await expect(runner().run(req())).resolves.toMatchObject({ engine: 'on-device' });
    status = { ...okStatus, online: false, device: 'unavailable' };
    expect(await code(runner().run(req()))).toBe('OFFLINE');
  });

  it('SPEC-AI-09: CLOUD_DISABLED is checked before OFFLINE', async () => {
    values = { ...DEFAULT_RUNTIME_VALUES, cloud_enabled: false };
    online = false;
    expect(await code(runner().run(req({ mode: 'ONLY_IN_CLOUD' })))).toBe('CLOUD_DISABLED');
  });
});

describe('SPEC-AI-11 image guard', () => {
  it.each(['image/webp', 'image/gif', 'application/pdf'])('SPEC-AI-11: mime %s -> IMAGE_UNSUPPORTED', async (mime) => {
    const bad = { ...img, mime } as unknown as typeof img;
    expect(await code(runner().run(req({ images: [bad] })))).toBe('IMAGE_UNSUPPORTED');
    expect(generate).not.toHaveBeenCalled();
  });

  it('SPEC-AI-11, SPEC-AI-05: base64 with a data: prefix is rejected; jpeg and png pass', async () => {
    const prefixed = { ...img, base64: 'data:image/png;base64,AAAA' };
    expect(await code(runner().run(req({ images: [prefixed] })))).toBe('IMAGE_UNSUPPORTED');
    await expect(runner().run(req({ images: [img, { ...img, mime: 'image/jpeg' }] }))).resolves.toBeDefined();
  });

  it('SPEC-AI-05: content is the user text then inlineData parts, with a signal option', async () => {
    await runner().run(req({ images: [img] }));
    const [content, opts] = generate.mock.calls[0] ?? [];
    expect(content).toEqual([
      { type: 'text', text: 'Is it right?' },
      { type: 'inlineData', inlineData: { mimeType: 'image/png', data: 'AAAA' } },
    ]);
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('SPEC-AI-04 result', () => {
  it('SPEC-AI-04: cloud result has engine cloud, model name, bytesSent and durationMs from the clock', async () => {
    generate.mockImplementation(async () => {
      nowMs = 250;
      return reply(JSON.stringify(GOOD));
    });
    const r = req({ images: [img] });
    const out = await runner().run(r);
    expect(out.engine).toBe('cloud');
    expect(out.model).toBe(DEFAULT_RUNTIME_VALUES.cloud_first_pass_model);
    expect(out.durationMs).toBe(250);
    expect(out.bytesSent).toBe(
      new TextEncoder().encode(JSON.stringify({ system: r.system, user: r.user, images: r.images })).length,
    );
  });

  it('SPEC-AI-04: missing inferenceSource is cloud under ONLY_IN_CLOUD', async () => {
    generate.mockResolvedValue(reply(JSON.stringify(GOOD), { inferenceSource: undefined }));
    await expect(runner().run(req({ mode: 'ONLY_IN_CLOUD' }))).resolves.toMatchObject({ engine: 'cloud' });
  });

  it('SPEC-AI-04: missing inferenceSource under PREFER_ON_DEVICE -> AI_FAILED', async () => {
    generate.mockResolvedValue(reply(JSON.stringify(GOOD), { inferenceSource: undefined }));
    expect(await code(runner().run(req()))).toBe('AI_FAILED');
  });
});

describe('SPEC-AI-06 zod validation and one retry', () => {
  it('SPEC-AI-06: valid output is returned parsed, raw text never', async () => {
    const out = await runner().run(req());
    expect(out.json).toEqual(GOOD);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['not json', 'this is not json'],
    ['empty text', ''],
    ['wrong enum', JSON.stringify({ ...GOOD, verdict: 'maybe' })],
    ['missing field', JSON.stringify({ verdict: 'pass' })],
    ['over-long field (zod limit)', JSON.stringify({ ...GOOD, explanation: 'x'.repeat(301) })],
    ['array instead of object', '[]'],
  ])('SPEC-AI-06: malformed (%s) twice -> exactly one retry -> AI_BAD_OUTPUT', async (_n, text) => {
    generate.mockResolvedValue(reply(text));
    expect(await code(runner().run(req()))).toBe('AI_BAD_OUTPUT');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('SPEC-AI-06: the retry appends the JSON reminder to the user text and recovers', async () => {
    generate.mockResolvedValueOnce(reply('garbage')).mockResolvedValueOnce(reply(JSON.stringify(GOOD)));
    const out = await runner().run(req({ images: [img] }));
    expect(out.json).toEqual(GOOD);
    expect(generate.mock.calls[0]?.[0][0].text).toBe('Is it right?');
    expect(generate.mock.calls[1]?.[0][0].text).toBe('Is it right?\nReturn only valid JSON matching the schema.');
    expect(generate.mock.calls[1]?.[0]).toHaveLength(2);
  });

  it('SPEC-AI-06, SPEC-AI-04: bytesSent counts both attempts when a retry happened', async () => {
    const one = await runner().run(req());
    generate
      .mockReset()
      .mockResolvedValueOnce(reply('garbage'))
      .mockResolvedValueOnce(reply(JSON.stringify(GOOD)));
    const two = await runner().run(req());
    expect(two.bytesSent).toBeGreaterThan(one.bytesSent * 2 - 1);
  });

  it('SPEC-AI-06, SPEC-AI-10: an SDK parse-failed error takes the retry path', async () => {
    generate
      .mockRejectedValueOnce(new AIError('parse-failed', 'bad'))
      .mockResolvedValueOnce(reply(JSON.stringify(GOOD)));
    await expect(runner().run(req())).resolves.toMatchObject({ json: GOOD });
    generate.mockReset().mockRejectedValue(new AIError('parse-failed', 'bad'));
    expect(await code(runner().run(req()))).toBe('AI_BAD_OUTPUT');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it.each<AiTask>(['extract-contract', 'infer-responsive', 'deep-analysis'])(
    'SPEC-AI-06: %s output is validated by that task schema',
    async (task) => {
      generate.mockResolvedValue(reply(JSON.stringify(GOOD)));
      expect(await code(runner().run(req({ task, consent: task === 'deep-analysis' ? deep : project })))).toBe(
        'AI_BAD_OUTPUT',
      );
    },
  );

  it('SPEC-AI-06: extract-contract with more than 8 requirements is re-checked and rejected', async () => {
    const item = {
      category: 'presence',
      statement: 's',
      condition: 'c',
      checkKind: 'presence',
      box_2d: [0, 0, 10, 10],
      matchHint: {},
    };
    generate.mockResolvedValue(reply(JSON.stringify({ requirements: Array(9).fill(item) })));
    expect(await code(runner().run(req({ task: 'extract-contract' })))).toBe('AI_BAD_OUTPUT');
  });
});

describe('SPEC-AI-08 timeouts and abort', () => {
  const never = () => new Promise(() => {});

  const timesOutAfter = async (mode: AiMode, ms: number, over: Partial<AiRequest> = {}) => {
    vi.useFakeTimers();
    generate.mockImplementation(never);
    let err: unknown;
    const p = runner()
      .run(req({ mode, ...over }))
      .catch((e) => {
        err = e;
      });
    await vi.advanceTimersByTimeAsync(ms - 1);
    expect(err, 'still waiting one ms before the limit').toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(err).toBeInstanceOf(CuiError);
    expect((err as CuiError).code).toBe('AI_TIMEOUT');
    expect((err as CuiError).retryable).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1); // a timeout is never retried: that would double the wait
  };

  it.each([
    ['ONLY_ON_DEVICE', 180_000],
    ['PREFER_ON_DEVICE', 180_000], // the device is usable, so it may be the one answering
    ['ONLY_IN_CLOUD', 60_000],
  ] as const)('SPEC-AI-08: %s times out after %d ms -> AI_TIMEOUT (retryable)', (mode, ms) => timesOutAfter(mode, ms));

  it('SPEC-AI-08: PREFER_ON_DEVICE with no usable device is a cloud wait of 60 s', async () => {
    status = { ...okStatus, device: 'unavailable' };
    await timesOutAfter('PREFER_ON_DEVICE', 60_000);
  });

  it('SPEC-AI-08: PREFER_ON_DEVICE with an image the device cannot take is a cloud wait of 60 s', async () => {
    status = { ...okStatus, deviceImage: false };
    await timesOutAfter('PREFER_ON_DEVICE', 60_000, { images: [img] });
  });

  it('SPEC-AI-08: the on-device wait follows on_device_timeout_s from Remote Config, read per request', async () => {
    values = { ...DEFAULT_RUNTIME_VALUES, on_device_timeout_s: 90 };
    await timesOutAfter('ONLY_ON_DEVICE', 90_000);
  });

  it('SPEC-AI-08: the cloud wait does not change with on_device_timeout_s', async () => {
    values = { ...DEFAULT_RUNTIME_VALUES, on_device_timeout_s: 600 };
    await timesOutAfter('ONLY_IN_CLOUD', 60_000);
  });

  it('SPEC-AI-08: a slow but successful on-device answer at 100 s is kept (the old 45 s limit would have failed it)', async () => {
    vi.useFakeTimers();
    generate.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(reply(JSON.stringify(GOOD), { inferenceSource: 'on_device' })), 100_000),
        ),
    );
    const p = runner().run(req({ mode: 'ONLY_ON_DEVICE', consent: undefined }));
    await vi.advanceTimersByTimeAsync(100_000);
    expect((await p).engine).toBe('on-device');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('SPEC-AI-08: the SDK signal is aborted on timeout', async () => {
    vi.useFakeTimers();
    let sdkSignal: AbortSignal | undefined;
    generate.mockImplementation((_c: unknown, o: { signal: AbortSignal }) => {
      sdkSignal = o.signal;
      return never();
    });
    const p = runner()
      .run(req({ mode: 'ONLY_IN_CLOUD' }))
      .catch(() => {});
    await vi.advanceTimersByTimeAsync(60_000);
    await p;
    expect(sdkSignal?.aborted).toBe(true);
  });

  it('SPEC-AI-08: the timer is cleared after success (no pending timers)', async () => {
    vi.useFakeTimers();
    await runner().run(req());
    expect(vi.getTimerCount()).toBe(0);
  });

  it('SPEC-AI-08: the retry gets its own timeout budget', async () => {
    vi.useFakeTimers();
    generate.mockResolvedValueOnce(reply('garbage')).mockImplementationOnce(never);
    let err: unknown;
    const p = runner()
      .run(req({ mode: 'ONLY_IN_CLOUD' }))
      .catch((e) => {
        err = e;
      });
    await vi.advanceTimersByTimeAsync(59_999);
    expect(err).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect((err as CuiError).code).toBe('AI_TIMEOUT');
  });

  it('SPEC-AI-08: a caller abort mid-flight rejects with AI_FAILED, aborts the SDK signal and clears the timer', async () => {
    vi.useFakeTimers();
    let sdkSignal: AbortSignal | undefined;
    generate.mockImplementation((_c: unknown, o: { signal: AbortSignal }) => {
      sdkSignal = o.signal;
      return never();
    });
    const c = new AbortController();
    const p = code(runner().run(req(), c.signal));
    await vi.advanceTimersByTimeAsync(10);
    c.abort();
    expect(await p).toBe('AI_FAILED');
    expect(sdkSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('SPEC-AI-08: no retry after a caller abort', async () => {
    const c = new AbortController();
    generate.mockImplementation(async () => {
      c.abort();
      return reply('garbage');
    });
    expect(await code(runner().run(req(), c.signal))).toBe('AI_FAILED');
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe('SPEC-AI-10 error map', () => {
  const sdkErr = (c: string, status?: number) =>
    new AIError(c as never, 'raw sdk text with secrets', status ? { status } : undefined);
  const fails = (e: unknown) => generate.mockRejectedValue(e);

  it('SPEC-AI-10: HTTP 429 -> QUOTA_EXCEEDED', async () => {
    fails(sdkErr('fetch-error', 429));
    expect(await code(runner().run(req()))).toBe('QUOTA_EXCEEDED');
  });

  it.each([401, 403])('SPEC-AI-10: HTTP %d -> APPCHECK_FAILED', async (s) => {
    fails(sdkErr('fetch-error', s));
    expect(await code(runner().run(req({ mode: 'ONLY_IN_CLOUD' })))).toBe('APPCHECK_FAILED');
  });

  it.each(['appCheck/throttled', 'appCheck/fetch-status-error', 'appCheck/recaptcha-error'])(
    'SPEC-AI-10: an App Check failure (%s) surfaced as any error -> APPCHECK_FAILED',
    async (c) => {
      fails(
        Object.assign(new Error(`Firebase: Requests throttled due to 403 error. (${c}).`), {
          code: c,
          name: 'FirebaseError',
        }),
      );
      expect(await code(runner().run(req({ mode: 'ONLY_IN_CLOUD' })))).toBe('APPCHECK_FAILED');
    },
  );

  it('SPEC-AI-10: an AIError whose text names App Check -> APPCHECK_FAILED', async () => {
    fails(new AIError('fetch-error' as never, 'App Check token exchange failed: App attestation failed'));
    expect(await code(runner().run(req({ mode: 'ONLY_IN_CLOUD' })))).toBe('APPCHECK_FAILED');
  });

  it('SPEC-AI-10: a plain network TypeError stays AI_FAILED', async () => {
    fails(new TypeError('Failed to fetch'));
    expect(await code(runner().run(req({ mode: 'ONLY_IN_CLOUD' })))).toBe('AI_FAILED');
  });

  it.each(['PREFER_ON_DEVICE', 'ONLY_IN_CLOUD'] as const)(
    'SPEC-AI-10: api-not-enabled in %s (even with HTTP 403) -> AI_NOT_ENABLED',
    async (mode) => {
      fails(sdkErr('api-not-enabled', 403));
      expect(await code(runner().run(req({ mode })))).toBe('AI_NOT_ENABLED');
    },
  );

  it.each(['api-not-enabled', 'unsupported'])('SPEC-AI-10: ONLY_ON_DEVICE + %s -> DEVICE_UNAVAILABLE', async (c) => {
    fails(sdkErr(c));
    expect(await code(runner().run(req({ mode: 'ONLY_ON_DEVICE' })))).toBe('DEVICE_UNAVAILABLE');
  });

  it('SPEC-AI-10: unsupported in a cloud-capable mode -> AI_FAILED', async () => {
    fails(sdkErr('unsupported'));
    expect(await code(runner().run(req()))).toBe('AI_FAILED');
  });

  it.each([
    ['prompt blocked', { promptFeedback: { blockReason: 'SAFETY' } }],
    ['no candidates', { candidates: [] }],
    ['candidates missing', { candidates: undefined }],
    ['finishReason SAFETY', { candidates: [{ finishReason: 'SAFETY' }] }],
    ['finishReason PROHIBITED_CONTENT', { candidates: [{ finishReason: 'PROHIBITED_CONTENT' }] }],
  ])('SPEC-AI-10: blocked or empty candidates (%s) -> AI_BLOCKED, no retry', async (_n, over) => {
    generate.mockResolvedValue(reply(JSON.stringify(GOOD), over as Resp));
    expect(await code(runner().run(req()))).toBe('AI_BLOCKED');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('SPEC-AI-10: text() throwing a response-error is not leaked raw -> AI_BLOCKED', async () => {
    generate.mockResolvedValue(
      reply('', {
        text: () => {
          throw new AIError('response-error', 'blocked secret');
        },
      }),
    );
    expect(await code(runner().run(req()))).toBe('AI_BLOCKED');
  });

  it.each([
    ['other AIError', sdkErr('error')],
    ['response-error', sdkErr('response-error')],
    ['plain Error', new Error('boom')],
    ['non-error throw', 'boom'],
    ['AbortError', Object.assign(new Error('x'), { name: 'AbortError' })],
  ])('SPEC-AI-10: %s -> AI_FAILED without leaking SDK text', async (_n, e) => {
    fails(e);
    try {
      await runner().run(req());
      expect.unreachable();
    } catch (x) {
      expect((x as CuiError).code).toBe('AI_FAILED');
      expect((x as CuiError).message).not.toContain('secrets');
      expect((x as CuiError).message).not.toContain('boom');
    }
  });

  it('SPEC-AI-10, SPEC-AI-09: a fetch-error after the connection dropped -> OFFLINE', async () => {
    generate.mockImplementation(async () => {
      online = false;
      throw sdkErr('fetch-error');
    });
    expect(await code(runner().run(req({ mode: 'ONLY_IN_CLOUD' })))).toBe('OFFLINE');
  });

  it('SPEC-AI-10: an existing CuiError from inside is passed through unchanged', async () => {
    fails(new CuiError('DAILY_CAP'));
    expect(await code(runner().run(req()))).toBe('DAILY_CAP');
  });

  it('SPEC-AI-10: model construction failure (e.g. invalid schema) -> AI_FAILED', async () => {
    sdk.getGenerativeModel.mockImplementation(() => {
      throw new AIError('invalid-schema', 'nope');
    });
    expect(await code(runner().run(req()))).toBe('AI_FAILED');
  });

  it('SPEC-SEC-04: no console output on an error path', async () => {
    const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((k) => vi.spyOn(console, k));
    fails(sdkErr('fetch-error', 429));
    await code(runner().run(req()));
    for (const s of spies) expect(s).not.toHaveBeenCalled();
    for (const s of spies) s.mockRestore();
  });
});

describe('createAiEngine run wiring', () => {
  it('SPEC-AI-09: createAiEngine().run works for ONLY_IN_CLOUD and keeps the public shape', async () => {
    const engine = createAiEngine({ app, config, clock });
    expect(typeof engine.status).toBe('function');
    expect(typeof engine.downloadDeviceModel).toBe('function');
    const out = await engine.run(req({ mode: 'ONLY_IN_CLOUD' }));
    expect(out.engine).toBe('cloud');
  });
});
