import {
  type AiMode,
  type AiRequest,
  type AiTask,
  CuiError,
  DEFAULT_RUNTIME_VALUES,
  DeepOutputSchema,
  type EngineStatus,
  ERROR_CODES,
  ExtractOutputSchema,
  InferOutputSchema,
  JudgeOutputSchema,
  mintConsent,
  resolveMode,
} from '@kernel';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFakeAiEngine,
  DEFAULT_FAKE_OUTPUTS,
  type FakeAiConfig,
  STATUS_SCENARIOS,
} from '../../../src/app/testing/fake-ai-engine';

// SPEC-TEST-01, SPEC-AI-12, SPEC-AI-02, SPEC §7.2: scripted status, canned JSON, calls[], engine selection, guards.

const project = mintConsent({ scope: 'project', projectId: 'p1' }, { isTrusted: true });
const deep = mintConsent({ scope: 'deep', runId: 'r1' }, { isTrusted: true });
const image = { mime: 'image/png' as const, base64: 'AAAA', bytes: 3, role: 'pair' as const };

const req = (over: Partial<AiRequest> = {}): AiRequest => ({
  task: 'judge',
  mode: 'ONLY_ON_DEVICE',
  system: 'sys',
  user: 'usr',
  images: [],
  promptVersion: '1',
  allowedNumbers: [],
  ...over,
});

const code = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (e) {
    return e instanceof CuiError ? e.code : `non-CuiError: ${String(e)}`;
  }
  return 'resolved';
};

const make = (config: FakeAiConfig = {}) => createFakeAiEngine(config, {});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SPEC-TEST-01, SPEC §7.2: the six status scenarios plus offline', () => {
  it('SPEC §7.2: available+image', async () => {
    expect(await make({ status: 'available+image' }).status()).toEqual({
      device: 'available',
      deviceImage: true,
      online: true,
      cloud: 'enabled',
    });
  });

  it('SPEC §7.2: available text-only', async () => {
    expect(await make({ status: 'available-text-only' }).status()).toEqual({
      device: 'available',
      deviceImage: false,
      reason: 'image-flag-off',
      online: true,
      cloud: 'enabled',
    });
  });

  it('SPEC §7.2: downloadable', async () => {
    expect(await make({ status: 'downloadable' }).status()).toMatchObject({ device: 'downloadable', online: true });
  });

  it('SPEC §7.2: downloading(0.4)', async () => {
    expect(await make({ status: 'downloading' }).status()).toMatchObject({
      device: 'downloading',
      downloadProgress: 0.4,
    });
  });

  it('SPEC §7.2: unavailable(not-desktop-chrome)', async () => {
    expect(await make({ status: 'unavailable-not-desktop-chrome' }).status()).toMatchObject({
      device: 'unavailable',
      deviceImage: false,
      reason: 'not-desktop-chrome',
    });
  });

  it('SPEC §7.2: unavailable(image-flag-off)', async () => {
    expect(await make({ status: 'unavailable-image-flag-off' }).status()).toMatchObject({
      device: 'unavailable',
      deviceImage: false,
      reason: 'image-flag-off',
    });
  });

  it('SPEC §7.2: offline is a modifier over any scenario (context.setOffline analogue)', async () => {
    for (const name of Object.keys(STATUS_SCENARIOS) as (keyof typeof STATUS_SCENARIOS)[]) {
      const s = await make({ status: name, online: false }).status();
      expect(s.online, name).toBe(false);
      expect(s.device, name).toBe(STATUS_SCENARIOS[name].device);
    }
  });

  it('SPEC §7.2: a partial EngineStatus object overrides the default scenario', async () => {
    expect(await make({ status: { cloud: 'disabled' } }).status()).toEqual({
      device: 'available',
      deviceImage: true,
      online: true,
      cloud: 'disabled',
    });
  });

  it('SPEC §7.2: the default status is available+image', async () => {
    expect(await make().status()).toEqual(STATUS_SCENARIOS['available+image']);
  });

  it('SPEC §7.2: status() reads the live config (a test can change it between calls)', async () => {
    const cfg: FakeAiConfig = { status: 'available+image' };
    const engine = make(cfg);
    cfg.status = 'unavailable-not-desktop-chrome';
    expect((await engine.status()).device).toBe('unavailable');
  });

  it('SPEC §7.2: status() returns a copy (mutating it does not change the scenario)', async () => {
    const s = await make({ status: 'available+image' }).status();
    s.device = 'unavailable';
    expect(STATUS_SCENARIOS['available+image'].device).toBe('available');
  });
});

describe('SPEC-AI-07, PRD-F-11.2: downloadDeviceModel', () => {
  it('SPEC-AI-07: downloadable -> progress 0..1 increasing, then available with fresh status', async () => {
    const cfg: FakeAiConfig = { status: 'downloadable' };
    const engine = make(cfg);
    const seen: number[] = [];
    const after = await engine.downloadDeviceModel((p) => seen.push(p));
    expect(seen.length).toBeGreaterThan(1);
    expect(seen[0]).toBeGreaterThan(0);
    expect(seen.at(-1)).toBe(1);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    expect(after).toMatchObject({ device: 'available', deviceImage: true });
    expect((await engine.status()).device).toBe('available');
  });

  it('SPEC-AI-07: downloading -> completes the download too', async () => {
    const engine = make({ status: 'downloading' });
    const after = await engine.downloadDeviceModel(() => undefined);
    expect(after.device).toBe('available');
  });

  it('SPEC-AI-07: already available -> resolves with the status and reports completion', async () => {
    const seen: number[] = [];
    const after = await make({ status: 'available+image' }).downloadDeviceModel((p) => seen.push(p));
    expect(after.device).toBe('available');
    expect(seen.at(-1)).toBe(1);
  });

  it('SPEC-AI-07: unavailable -> DEVICE_UNAVAILABLE', async () => {
    expect(await code(make({ status: 'unavailable-not-desktop-chrome' }).downloadDeviceModel(() => undefined))).toBe(
      'DEVICE_UNAVAILABLE',
    );
  });

  it('SPEC-AI-07: a download keeps online/cloud settings of the scenario', async () => {
    const after = await make({ status: 'downloadable', online: false }).downloadDeviceModel(() => undefined);
    expect(after.online).toBe(false);
  });
});

describe('SPEC-AI-02, S1, PRD-M-06: guards (the fake is the adapter contract)', () => {
  const cloudModes: AiMode[] = ['PREFER_ON_DEVICE', 'ONLY_IN_CLOUD'];

  it('SPEC-AI-02 (a): a cloud-capable mode without a consent token is rejected with CONSENT_REQUIRED', async () => {
    for (const mode of cloudModes) {
      const engine = make({ status: 'available+image' });
      expect(await code(engine.run(req({ mode }))), mode).toBe('CONSENT_REQUIRED');
    }
  });

  it('SPEC-AI-02 (a): cloud mode without a token is rejected whatever the device says (cloud-only user, device unavailable)', async () => {
    const engine = make({ status: 'unavailable-not-desktop-chrome' });
    expect(await code(engine.run(req({ mode: 'ONLY_IN_CLOUD' })))).toBe('CONSENT_REQUIRED');
  });

  it('SPEC-AI-02 (a): the rejected request is still recorded in calls[] so a test can prove who called', async () => {
    const engine = make();
    await code(engine.run(req({ mode: 'ONLY_IN_CLOUD' })));
    expect(engine.calls).toHaveLength(1);
    expect(engine.calls[0]?.mode).toBe('ONLY_IN_CLOUD');
    expect(engine.calls[0]?.consent).toBeUndefined();
  });

  it('SPEC-AI-02 (a): project and deep tokens both satisfy a cloud-capable first-pass task', async () => {
    const engine = make({ status: 'unavailable-not-desktop-chrome' });
    expect((await engine.run(req({ mode: 'PREFER_ON_DEVICE', consent: project }))).engine).toBe('cloud');
    expect((await engine.run(req({ mode: 'ONLY_IN_CLOUD', consent: project }))).engine).toBe('cloud');
  });

  it('SPEC-AI-02 (a): deep-analysis requires scope deep; a project token is rejected', async () => {
    const engine = make();
    expect(await code(engine.run(req({ task: 'deep-analysis', mode: 'ONLY_IN_CLOUD', consent: project })))).toBe(
      'CONSENT_REQUIRED',
    );
    expect((await engine.run(req({ task: 'deep-analysis', mode: 'ONLY_IN_CLOUD', consent: deep }))).engine).toBe(
      'cloud',
    );
  });

  it('SPEC-AI-02 (a): ONLY_ON_DEVICE needs no token', async () => {
    expect((await make().run(req())).engine).toBe('on-device');
  });

  it('SPEC-AI-02 (b): an ONLY_ON_DEVICE result labelled cloud by the SDK is discarded -> AI_FAILED', async () => {
    const engine = make({ inferenceSource: 'cloud' });
    expect(await code(engine.run(req()))).toBe('AI_FAILED');
  });

  it('SPEC-AI-02 (c): ONLY_ON_DEVICE is never run unless the device is available', async () => {
    const expected: Record<string, string> = {
      downloadable: 'DEVICE_UNAVAILABLE',
      downloading: 'DEVICE_DOWNLOADING',
      'unavailable-not-desktop-chrome': 'DEVICE_UNAVAILABLE',
      'unavailable-image-flag-off': 'DEVICE_UNAVAILABLE',
    };
    for (const [scenario, c] of Object.entries(expected)) {
      const engine = make({ status: scenario as keyof typeof STATUS_SCENARIOS });
      expect(await code(engine.run(req())), scenario).toBe(c);
    }
  });

  it('SPEC-AI-02 (c): ONLY_ON_DEVICE with an image on a text-only device -> DEVICE_NO_IMAGE; text-only requests still run', async () => {
    const engine = make({ status: 'available-text-only' });
    expect(await code(engine.run(req({ images: [image] })))).toBe('DEVICE_NO_IMAGE');
    expect((await engine.run(req())).engine).toBe('on-device');
  });

  it('SPEC-AI-09: cloud disabled -> CLOUD_DISABLED for cloud-capable modes, not for ONLY_ON_DEVICE', async () => {
    const engine = make({ status: { cloud: 'disabled' } });
    expect(await code(engine.run(req({ mode: 'ONLY_IN_CLOUD', consent: project })))).toBe('CLOUD_DISABLED');
    expect(await code(engine.run(req({ mode: 'PREFER_ON_DEVICE', consent: project })))).toBe('CLOUD_DISABLED');
    expect((await engine.run(req())).engine).toBe('on-device');
  });

  it('SPEC-AI-09: offline ONLY_IN_CLOUD -> OFFLINE; offline PREFER_ON_DEVICE falls to the device when usable, else OFFLINE', async () => {
    expect(await code(make({ online: false }).run(req({ mode: 'ONLY_IN_CLOUD', consent: project })))).toBe('OFFLINE');
    const usable = await make({ online: false }).run(req({ mode: 'PREFER_ON_DEVICE', consent: project }));
    expect(usable.engine).toBe('on-device');
    expect(
      await code(
        make({ status: 'unavailable-not-desktop-chrome', online: false }).run(
          req({ mode: 'PREFER_ON_DEVICE', consent: project }),
        ),
      ),
    ).toBe('OFFLINE');
  });

  it('SPEC-AI-02, S1: every call plan from resolveMode passes the fake guards (kernel and adapter agree)', async () => {
    const scenarios = Object.keys(STATUS_SCENARIOS) as (keyof typeof STATUS_SCENARIOS)[];
    for (const scenario of scenarios) {
      for (const consented of [false, true]) {
        for (const needsImage of [false, true]) {
          const status = await make({ status: scenario }).status();
          const plan = resolveMode({
            setting: 'auto',
            purpose: 'first-pass',
            needsImage,
            status,
            ...(consented ? { projectConsent: project } : {}),
          });
          if (plan.kind !== 'call') continue;
          const r = await make({ status: scenario }).run(
            req({
              mode: plan.mode,
              images: needsImage ? [image] : [],
              ...(plan.consent ? { consent: plan.consent } : {}),
            }),
          );
          expect(r.requestedMode).toBe(plan.mode);
        }
      }
    }
  });
});

describe('SPEC §7.2: engine selection mimics the SDK', () => {
  it('SPEC §7.2: ONLY_ON_DEVICE -> on-device', async () => {
    expect((await make().run(req())).engine).toBe('on-device');
  });

  it('SPEC §7.2: PREFER_ON_DEVICE with the device available -> on-device', async () => {
    expect((await make().run(req({ mode: 'PREFER_ON_DEVICE', consent: project }))).engine).toBe('on-device');
  });

  it('SPEC §7.2: PREFER_ON_DEVICE with the device not available -> cloud', async () => {
    for (const status of ['downloadable', 'downloading', 'unavailable-not-desktop-chrome'] as const) {
      expect((await make({ status }).run(req({ mode: 'PREFER_ON_DEVICE', consent: project }))).engine, status).toBe(
        'cloud',
      );
    }
  });

  it('SPEC §7.2: PREFER_ON_DEVICE with an image on a text-only device -> cloud', async () => {
    const r = await make({ status: 'available-text-only' }).run(
      req({ mode: 'PREFER_ON_DEVICE', consent: project, images: [image] }),
    );
    expect(r.engine).toBe('cloud');
  });

  it('SPEC §7.2: ONLY_IN_CLOUD -> cloud, even with the device available', async () => {
    expect((await make().run(req({ mode: 'ONLY_IN_CLOUD', consent: project }))).engine).toBe('cloud');
  });

  it('SPEC-AI-04: requestedMode echoes the request; bytesSent is 0 on-device and the UTF-8 payload size on cloud', async () => {
    const onDevice = await make().run(req({ system: 'sys', user: 'usr' }));
    expect(onDevice.bytesSent).toBe(0);
    expect(onDevice.requestedMode).toBe('ONLY_ON_DEVICE');
    const r = req({ mode: 'ONLY_IN_CLOUD', consent: project, system: 'sÿs', user: 'ü', images: [image] });
    const cloud = await make().run(r);
    const expected = new TextEncoder().encode(
      JSON.stringify({ system: r.system, user: r.user, images: r.images }),
    ).length;
    expect(cloud.bytesSent).toBe(expected);
    expect(cloud.requestedMode).toBe('ONLY_IN_CLOUD');
  });

  it('SPEC-AI-01: cloud model names follow Remote Config defaults (deep_model for deep-analysis)', async () => {
    const first = await make().run(req({ mode: 'ONLY_IN_CLOUD', consent: project }));
    expect(first.model).toBe(DEFAULT_RUNTIME_VALUES.cloud_first_pass_model);
    const d = await make().run(req({ task: 'deep-analysis', mode: 'ONLY_IN_CLOUD', consent: deep }));
    expect(d.model).toBe(DEFAULT_RUNTIME_VALUES.deep_model);
  });

  it('SPEC-TEST-01: durationMs comes from the config (deterministic), default 1', async () => {
    expect((await make().run(req())).durationMs).toBe(1);
    expect((await make({ durationMs: 250 }).run(req())).durationMs).toBe(250);
  });
});

describe('SPEC-TEST-01: canned JSON per task', () => {
  const schemas = {
    'extract-contract': ExtractOutputSchema,
    'infer-responsive': InferOutputSchema,
    judge: JudgeOutputSchema,
    'deep-analysis': DeepOutputSchema,
  } as const;
  const tasks = Object.keys(schemas) as AiTask[];

  for (const task of tasks) {
    it(`SPEC-TEST-01: the default ${task} output passes its kernel schema`, async () => {
      const r = await make().run(req({ task }));
      expect(schemas[task].safeParse(r.json).success).toBe(true);
      expect(DEFAULT_FAKE_OUTPUTS[task]).toEqual(r.json);
    });
  }

  it('SPEC-TEST-01: a configured output replaces the default for that task only', async () => {
    const engine = make({
      outputs: { judge: { verdict: 'pass', confidence: 'high', explanation: 'ok', suggestedFix: 'none' } },
    });
    expect(((await engine.run(req({ task: 'judge' }))).json as { verdict: string }).verdict).toBe('pass');
    expect((await engine.run(req({ task: 'extract-contract' }))).json).toEqual(
      DEFAULT_FAKE_OUTPUTS['extract-contract'],
    );
  });

  it('SPEC-TEST-01: malformed output is returned as is (callers validate with zod, SPEC-AI-06)', async () => {
    const bad = { verdict: 'maybe' };
    const r = await make({ outputs: { judge: bad } }).run(req());
    expect(r.json).toEqual(bad);
    expect(JudgeOutputSchema.safeParse(r.json).success).toBe(false);
  });

  it('SPEC-TEST-01: a sequence of outputs is consumed in order and the last one repeats', async () => {
    const engine = make({ outputs: { judge: { sequence: [{ n: 1 }, { n: 2 }] } } });
    const got = [];
    for (let i = 0; i < 3; i++) got.push((await engine.run(req())).json);
    expect(got).toEqual([{ n: 1 }, { n: 2 }, { n: 2 }]);
  });

  it('SPEC-TEST-01: an output function receives the request (e.g. to answer per finding id)', async () => {
    const engine = make({ outputs: { judge: (r: AiRequest) => ({ echo: r.user }) } });
    expect((await engine.run(req({ user: 'hello' }))).json).toEqual({ echo: 'hello' });
  });

  it('SPEC-TEST-01: outputs are cloned so a caller mutating the result cannot change the next one', async () => {
    const engine = make();
    const a = (await engine.run(req())).json as { explanation: string };
    a.explanation = 'changed';
    const b = (await engine.run(req())).json as { explanation: string };
    expect(b.explanation).not.toBe('changed');
  });

  it('SPEC-TEST-01, SPEC-UI-05: a configured error code is thrown as CuiError for that task (all 21 codes)', async () => {
    for (const c of ERROR_CODES) {
      const engine = make({ errors: { judge: c } });
      let err: unknown;
      try {
        await engine.run(req());
      } catch (e) {
        err = e;
      }
      expect(err, c).toBeInstanceOf(CuiError);
      expect((err as CuiError).code).toBe(c);
      // other tasks are unaffected
      expect((await engine.run(req({ task: 'extract-contract' }))).engine).toBe('on-device');
    }
  });

  it('SPEC-TEST-01: an error scripted for a task is recorded in calls[] too', async () => {
    const engine = make({ errors: { judge: 'AI_FAILED' } });
    await code(engine.run(req()));
    expect(engine.calls).toHaveLength(1);
  });

  it('SPEC-AI-08: an already aborted signal -> AI_FAILED without an answer', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    expect(await code(make().run(req(), ctrl.signal))).toBe('AI_FAILED');
  });
});

describe('SPEC-TEST-01, SPEC-AI-12: calls[]', () => {
  it('SPEC-AI-12: records every request in order, with its mode, task and consent', async () => {
    const engine = make();
    await engine.run(req({ task: 'extract-contract' }));
    await engine.run(req({ task: 'judge', mode: 'PREFER_ON_DEVICE', consent: project }));
    expect(engine.calls.map((c) => [c.task, c.mode])).toEqual([
      ['extract-contract', 'ONLY_ON_DEVICE'],
      ['judge', 'PREFER_ON_DEVICE'],
    ]);
    expect(engine.calls[1]?.consent).toEqual(project);
  });

  it('SPEC-AI-12: status() and downloadDeviceModel() are not calls', async () => {
    const engine = make({ status: 'downloadable' });
    await engine.status();
    await engine.downloadDeviceModel(() => undefined);
    expect(engine.calls).toHaveLength(0);
  });

  it('SPEC-AI-12: recorded requests are snapshots (mutating the original afterwards does not rewrite history)', async () => {
    const engine = make();
    const r = req({ user: 'before' });
    await engine.run(r);
    r.user = 'after';
    expect(engine.calls[0]?.user).toBe('before');
  });

  it('SPEC-TEST-01: calls is the same array as config.calls, so Playwright can read window.__CUI_FAKE__.calls', async () => {
    const cfg: FakeAiConfig = {};
    const engine = make(cfg);
    await engine.run(req());
    expect(cfg.calls).toBe(engine.calls);
    expect(cfg.calls).toHaveLength(1);
  });

  it('SPEC-TEST-01: "no cloud-mode call before consent" is checkable from calls[]', async () => {
    const engine = make();
    await engine.run(req());
    expect(engine.calls.filter((c) => c.mode !== 'ONLY_ON_DEVICE')).toEqual([]);
  });
});

describe('SPEC-TEST-01, SPEC-TEST-02: window.__CUI_FAKE__ seam', () => {
  it('SPEC-TEST-01: with no explicit config the engine reads globalThis.__CUI_FAKE__ and publishes calls on it', async () => {
    const handle: FakeAiConfig = { status: 'downloadable' };
    vi.stubGlobal('__CUI_FAKE__', handle);
    const engine = createFakeAiEngine();
    expect((await engine.status()).device).toBe('downloadable');
    await code(engine.run(req()));
    expect(handle.calls).toBe(engine.calls);
  });

  it('SPEC-TEST-01: with no global at all it creates one so tests can attach later', () => {
    const host: { __CUI_FAKE__?: FakeAiConfig } = {};
    const engine = createFakeAiEngine(undefined, host);
    expect(host.__CUI_FAKE__?.calls).toBe(engine.calls);
  });

  it('SPEC-TEST-01: a status changed on the global handle mid-test takes effect on the next call', async () => {
    const handle: FakeAiConfig = { status: 'available+image' };
    vi.stubGlobal('__CUI_FAKE__', handle);
    const engine = createFakeAiEngine();
    expect(await code(engine.run(req()))).toBe('resolved');
    handle.status = 'unavailable-not-desktop-chrome';
    expect(await code(engine.run(req()))).toBe('DEVICE_UNAVAILABLE');
  });

  it('SPEC-TEST-02: the fake is reachable only through dynamic import (no static import anywhere in src/)', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { ROOT } = await import('../../architecture/helpers');
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(ts|tsx)$/.test(n)) out.push(p);
      }
      return out;
    };
    const offenders: string[] = [];
    for (const f of walk(join(ROOT, 'src'))) {
      const text = readFileSync(f, 'utf8');
      if (/(^|\n)\s*(import|export)\s[^;]*from\s+['"][^'"]*fake-ai-engine['"]/.test(text)) offenders.push(f);
      if (!f.replaceAll('\\', '/').includes('/src/app/testing/') && text.includes('__CUI_FAKE__'))
        offenders.push(`${f} mentions __CUI_FAKE__`);
    }
    expect(offenders).toEqual([]);
  });

  it('SPEC-TEST-02: the fake imports only the kernel (and zod through it)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { ROOT } = await import('../../architecture/helpers');
    const text = readFileSync(join(ROOT, 'src/app/testing/fake-ai-engine.ts'), 'utf8');
    const specs = [...text.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    expect(specs.every((s) => s === '@kernel')).toBe(true);
  });
});

describe('PRD-M-06: EngineStatus type stays compatible', () => {
  it('SPEC-TEST-01: every scenario satisfies the EngineStatus port type', () => {
    const all: EngineStatus[] = Object.values(STATUS_SCENARIOS);
    expect(all).toHaveLength(6);
  });
});
