import type { AiEngine, AiRequest, EngineStatus, RuntimeConfig } from '@kernel';
import { CuiError, DEFAULT_RUNTIME_VALUES } from '@kernel';
import { describe, expect, it, vi } from 'vitest';
import { createLazyAiEngine, createLazyRuntimeConfig } from '../../../src/app/lazy-engine';

const READY: EngineStatus = { device: 'available', deviceImage: true, online: true, cloud: 'enabled' };
const REQ = { task: 'judge' } as unknown as AiRequest;

function inner(): AiEngine & { run: ReturnType<typeof vi.fn> } {
  return {
    status: vi.fn(async () => READY),
    downloadDeviceModel: vi.fn(async () => READY),
    run: vi.fn(async () => ({ json: {}, engine: 'cloud', durationMs: 1 })),
  } as unknown as AiEngine & { run: ReturnType<typeof vi.fn> };
}

describe('createLazyAiEngine', () => {
  it('SPEC-APP-01: status before resolution is unavailable/unknown and reports the browser online flag', async () => {
    const lazy = createLazyAiEngine(() => false);
    expect(await lazy.engine.status()).toEqual({
      device: 'unavailable',
      deviceImage: 'unknown',
      reason: 'unknown',
      online: false,
      cloud: 'disabled',
    });
    expect(lazy.resolved()).toBe(false);
  });

  it('SPEC-APP-01: a run before resolution waits for the engine, then calls it once', async () => {
    const lazy = createLazyAiEngine();
    const e = inner();
    const pending = lazy.engine.run(REQ);
    await Promise.resolve();
    expect(e.run).not.toHaveBeenCalled();
    lazy.resolve(e);
    await pending;
    expect(e.run).toHaveBeenCalledTimes(1);
    expect(e.run).toHaveBeenCalledWith(REQ, undefined);
  });

  it('SPEC-APP-01: after resolution status and download go straight to the engine', async () => {
    const lazy = createLazyAiEngine();
    const e = inner();
    lazy.resolve(e);
    expect(await lazy.engine.status()).toEqual(READY);
    await lazy.engine.downloadDeviceModel(() => undefined);
    expect(e.downloadDeviceModel).toHaveBeenCalledTimes(1);
  });

  it('SPEC-APP-01: subscribers are told once on resolution and not after unsubscribe', () => {
    const lazy = createLazyAiEngine();
    const a = vi.fn();
    const b = vi.fn();
    lazy.subscribe(a);
    lazy.subscribe(b)();
    lazy.resolve(inner());
    lazy.resolve(inner());
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it('SPEC-APP-01, SPEC-KERNEL-09: if the engine never loads, runs fail with a CuiError instead of hanging', async () => {
    const lazy = createLazyAiEngine();
    lazy.fail();
    await expect(lazy.engine.run(REQ)).rejects.toBeInstanceOf(CuiError);
    await expect(lazy.engine.run(REQ)).rejects.toMatchObject({ code: 'AI_FAILED' });
    expect((await lazy.engine.status()).device).toBe('unavailable');
  });

  it('SPEC-APP-01: an abort signal rejects a run still waiting for the engine', async () => {
    const lazy = createLazyAiEngine();
    const ac = new AbortController();
    const pending = lazy.engine.run(REQ, ac.signal);
    ac.abort();
    await expect(pending).rejects.toBeDefined();
  });
});

describe('createLazyRuntimeConfig', () => {
  it('SPEC-APP-01: get() returns the static defaults until the real config resolves', () => {
    const lazy = createLazyRuntimeConfig();
    expect(lazy.config.get()).toEqual(DEFAULT_RUNTIME_VALUES);
  });

  it('SPEC-APP-01: after resolution get() and refresh() use the real config; refresh waits for it', async () => {
    const lazy = createLazyRuntimeConfig();
    const real: RuntimeConfig = {
      get: () => ({ ...DEFAULT_RUNTIME_VALUES, deep_daily_cap: 7 }),
      refresh: vi.fn(async () => undefined),
    };
    const waiting = lazy.config.refresh();
    lazy.resolve(real);
    await waiting;
    expect(real.refresh).toHaveBeenCalledTimes(1);
    expect(lazy.config.get().deep_daily_cap).toBe(7);
  });

  it('SPEC-APP-01: refresh settles when the config is declared failed', async () => {
    const lazy = createLazyRuntimeConfig();
    const waiting = lazy.config.refresh();
    lazy.fail();
    await expect(waiting).resolves.toBeUndefined();
  });
});
