import 'fake-indexeddb/auto';
import type { AiEngine } from '@kernel';
import { CuiError, DEFAULT_RUNTIME_VALUES } from '@kernel';
import { describe, expect, it, vi } from 'vitest';
import { compose } from '../../../src/app/compose';
import { parseEnv } from '../../../src/app/env';
import { createFakeAiEngine } from '../../../src/app/testing/fake-ai-engine';
import { composeForTest } from '../../../tests/helpers/compose-test';

describe('composeForTest', () => {
  it('SPEC-APP-01, SPEC-TEST-01: builds the whole service graph with the fake engine and no Firebase', async () => {
    const { services } = await composeForTest();
    const p = await services.projects.create('Checkout');
    expect((await services.projects.list()).map((x) => x.name)).toEqual(['Checkout']);
    expect(p.name).toBe('Checkout');
    expect(await services.settings.read()).toMatchObject({ mode: 'auto', onboarded: false });
    expect((await services.ai.status()).device).toBe('available');
    expect(await services.contract.active(p.id)).toBeUndefined();
  });

  it('SPEC-APP-01: Run and Deep stubs do not break composition; they only fail when used', async () => {
    const { services } = await composeForTest();
    expect(services.run).toBeDefined();
    expect(services.deep).toBeDefined();
  });

  it('SPEC-APP-01: each call opens a fresh isolated store', async () => {
    const a = await composeForTest();
    await a.services.projects.create('One');
    const b = await composeForTest();
    expect(await b.services.projects.list()).toEqual([]);
  });

  it('SPEC-APP-01: the engine can be swapped for a scripted fake', async () => {
    const fake = createFakeAiEngine({ status: 'downloadable' }, {});
    const { services } = await composeForTest({ ai: fake });
    expect((await services.ai.status()).device).toBe('downloadable');
  });
});

describe('compose', () => {
  const e2e = parseEnv({ VITE_E2E: '1' }).env;
  const FB = {
    VITE_FIREBASE_API_KEY: 'k',
    VITE_FIREBASE_AUTH_DOMAIN: 'd',
    VITE_FIREBASE_PROJECT_ID: 'p',
    VITE_FIREBASE_APP_ID: 'a',
    VITE_FIREBASE_MESSAGING_SENDER_ID: 'm',
    VITE_RECAPTCHA_ENTERPRISE_KEY: 'r',
  };
  const storage = async () => (await composeForTest()).storage;
  const noConfig = { get: () => DEFAULT_RUNTIME_VALUES, refresh: async () => undefined };

  it('SPEC-APP-01, SPEC-TEST-01: the E2E branch resolves the engine with the fake and never loads Firebase', async () => {
    const fake: AiEngine = createFakeAiEngine({}, {});
    const loadFake = vi.fn(async () => fake);
    const loadFirebase = vi.fn();
    const { services, startEngine } = await compose(e2e, { storage, loadFake, loadFirebase });
    expect((await services.ai.status()).device).toBe('unavailable');
    await startEngine();
    expect(loadFake).toHaveBeenCalledTimes(1);
    expect(loadFirebase).not.toHaveBeenCalled();
    expect((await services.ai.status()).device).toBe('available');
  });

  it('SPEC-APP-01: outside E2E the engine and config come from Firebase, loaded only by startEngine', async () => {
    const env = parseEnv(FB).env;
    const fake = createFakeAiEngine({}, {});
    const loadFirebase = vi.fn(async () => ({ ai: fake, config: noConfig }));
    const loadFake = vi.fn();
    const { services, startEngine } = await compose(env, { storage, loadFake, loadFirebase });
    expect(loadFirebase).not.toHaveBeenCalled();
    await startEngine();
    expect(loadFirebase).toHaveBeenCalledWith(env.firebase);
    expect(loadFake).not.toHaveBeenCalled();
    expect((await services.ai.status()).device).toBe('available');
  });

  it('SPEC-APP-01, SPEC-APP-06: without Firebase config the engine stays unavailable and the sample path still composes', async () => {
    const env = parseEnv({}).env;
    const loadFirebase = vi.fn();
    const { services, startEngine } = await compose(env, { storage, loadFake: vi.fn(), loadFirebase });
    await startEngine();
    expect(loadFirebase).not.toHaveBeenCalled();
    expect((await services.ai.status()).device).toBe('unavailable');
    await expect(services.ai.run({} as never)).rejects.toBeInstanceOf(CuiError);
    expect(await services.projects.list()).toEqual([]);
  });

  it('SPEC-APP-01: a Firebase load failure degrades to unavailable instead of throwing out of startEngine', async () => {
    const env = parseEnv(FB).env;
    const loadFirebase = vi.fn(async () => {
      throw new Error('chunk failed');
    });
    const { services, startEngine } = await compose(env, { storage, loadFake: vi.fn(), loadFirebase });
    await expect(startEngine()).resolves.toBeUndefined();
    expect((await services.ai.status()).device).toBe('unavailable');
  });

  it('SPEC-APP-03: a storage rejection is not caught by compose; the caller shows STORAGE_UNAVAILABLE', async () => {
    const failing = async () => {
      throw new CuiError('STORAGE_UNAVAILABLE');
    };
    await expect(compose(e2e, { storage: failing })).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  });
});
