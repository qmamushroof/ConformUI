import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_RUNTIME_VALUES } from '@kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROOT } from '../../architecture/helpers';

const calls: string[] = [];
let remote: Record<string, string> = {};
let fetchImpl: () => Promise<boolean>;
const rc: { defaultConfig: Record<string, unknown>; settings: { minimumFetchIntervalMillis: number } } = {
  defaultConfig: {},
  settings: { minimumFetchIntervalMillis: 0 },
};
const appObj = { name: '[DEFAULT]' };
let lastConfig: unknown;
let lastAppCheck: { provider: { key: string }; isTokenAutoRefreshEnabled: boolean } | undefined;
let debugTokenAtAppCheck: unknown;

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn((cfg: unknown) => {
    calls.push('initializeApp');
    lastConfig = cfg;
    return appObj;
  }),
}));
vi.mock('firebase/app-check', () => ({
  ReCaptchaEnterpriseProvider: vi.fn(function (this: { key: string }, key: string) {
    this.key = key;
  }),
  initializeAppCheck: vi.fn((_app: unknown, opts: unknown) => {
    calls.push('initializeAppCheck');
    lastAppCheck = opts as typeof lastAppCheck;
    debugTokenAtAppCheck = (globalThis as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN;
    return {};
  }),
}));
vi.mock('firebase/remote-config', () => ({
  getRemoteConfig: vi.fn(() => {
    calls.push('getRemoteConfig');
    return rc;
  }),
  fetchAndActivate: vi.fn(() => {
    calls.push('fetchAndActivate');
    return fetchImpl();
  }),
  getAll: vi.fn(() => Object.fromEntries(Object.entries(remote).map(([k, v]) => [k, { asString: () => v }]))),
}));

const env = {
  apiKey: 'k',
  authDomain: 'a.firebaseapp.com',
  projectId: 'p',
  appId: 'app',
  messagingSenderId: 'm',
  recaptchaEnterpriseKey: 'rk',
  appCheckDebug: false,
};

async function load() {
  vi.resetModules();
  return (await import('../../../src/platform/firebase/index')).initFirebase;
}

beforeEach(() => {
  calls.length = 0;
  remote = {};
  fetchImpl = () => Promise.resolve(true);
  lastAppCheck = undefined;
  debugTokenAtAppCheck = undefined;
  rc.defaultConfig = {};
  delete (globalThis as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('initFirebase init order and App Check', () => {
  it('SPEC-FB-01: initializeApp, then App Check, then Remote Config defaults, then background fetch', async () => {
    const initFirebase = await load();
    const { app } = initFirebase(env);
    expect(app).toBe(appObj);
    expect(lastConfig).toMatchObject({ apiKey: 'k', projectId: 'p', appId: 'app', messagingSenderId: 'm' });
    expect(calls.slice(0, 3)).toEqual(['initializeApp', 'initializeAppCheck', 'getRemoteConfig']);
    expect(rc.defaultConfig).toEqual(DEFAULT_RUNTIME_VALUES);
    expect(calls).toContain('fetchAndActivate');
    expect(calls.indexOf('fetchAndActivate')).toBeGreaterThan(calls.indexOf('getRemoteConfig'));
  });

  it('SPEC-FB-02: returns synchronously without awaiting a never-resolving fetch', async () => {
    fetchImpl = () => new Promise(() => {});
    const initFirebase = await load();
    const { runtimeConfig } = initFirebase(env);
    expect(runtimeConfig.get()).toEqual(DEFAULT_RUNTIME_VALUES);
  });

  it('SPEC-FB-02, SPEC-FB-07: fetch rejection is swallowed and defaults stay', async () => {
    fetchImpl = () => Promise.reject(new Error('throttled'));
    const initFirebase = await load();
    const { runtimeConfig } = initFirebase(env);
    await expect(runtimeConfig.refresh()).resolves.toBeUndefined();
    await new Promise((r) => setTimeout(r, 0));
    expect(runtimeConfig.get()).toEqual(DEFAULT_RUNTIME_VALUES);
  });

  it('SPEC-FB-03: reCAPTCHA Enterprise provider with auto refresh and the configured key', async () => {
    const initFirebase = await load();
    initFirebase(env);
    expect(lastAppCheck?.provider.key).toBe('rk');
    expect(lastAppCheck?.isTokenAutoRefreshEnabled).toBe(true);
  });

  it('SPEC-FB-04: debug token set before initializeAppCheck when DEV and appCheckDebug', async () => {
    vi.stubEnv('DEV', true);
    const initFirebase = await load();
    initFirebase({ ...env, appCheckDebug: true, appCheckDebugToken: 'tok' });
    expect(debugTokenAtAppCheck).toBe('tok');
  });

  it('SPEC-FB-04: debug flag without a token falls back to true', async () => {
    vi.stubEnv('DEV', true);
    const initFirebase = await load();
    initFirebase({ ...env, appCheckDebug: true, appCheckDebugToken: '' });
    expect(debugTokenAtAppCheck).toBe(true);
  });

  it('SPEC-FB-04: no debug token when appCheckDebug is false', async () => {
    vi.stubEnv('DEV', true);
    const initFirebase = await load();
    initFirebase({ ...env, appCheckDebug: false, appCheckDebugToken: 'tok' });
    expect(debugTokenAtAppCheck).toBeUndefined();
  });

  it('SPEC-FB-04: no debug token outside DEV even when appCheckDebug is set', async () => {
    vi.stubEnv('DEV', false);
    const initFirebase = await load();
    initFirebase({ ...env, appCheckDebug: true, appCheckDebugToken: 'tok' });
    expect(debugTokenAtAppCheck).toBeUndefined();
  });
});

describe('RuntimeConfig', () => {
  it('SPEC-FB-06: minimumFetchIntervalMillis is 3_600_000', async () => {
    const initFirebase = await load();
    initFirebase(env);
    expect(rc.settings.minimumFetchIntervalMillis).toBe(3_600_000);
  });

  it('SPEC-FB-07: size_tolerance_pct "abc" and "500" yield default 8; "10" yields 10', async () => {
    const initFirebase = await load();
    const { runtimeConfig } = initFirebase(env);
    remote = { size_tolerance_pct: 'abc' };
    expect(runtimeConfig.get().size_tolerance_pct).toBe(8);
    remote = { size_tolerance_pct: '500' };
    expect(runtimeConfig.get().size_tolerance_pct).toBe(8);
    remote = { size_tolerance_pct: '10' };
    expect(runtimeConfig.get().size_tolerance_pct).toBe(10);
  });

  it('SPEC-FB-07: invalid keys are ignored one by one while valid siblings apply', async () => {
    const initFirebase = await load();
    const { runtimeConfig } = initFirebase(env);
    remote = { size_tolerance_pct: 'x', major_deviation_pct: '30', cloud_enabled: 'false', deep_model: 'm2' };
    const v = runtimeConfig.get();
    expect(v.size_tolerance_pct).toBe(8);
    expect(v.major_deviation_pct).toBe(30);
    expect(v.cloud_enabled).toBe(false);
    expect(v.deep_model).toBe('m2');
  });

  it.each(['', ' ', 'NaN', 'Infinity', '-5', '1e999'])('SPEC-FB-07: number value %j keeps default', async (bad) => {
    const initFirebase = await load();
    const { runtimeConfig } = initFirebase(env);
    remote = { deep_daily_cap: bad };
    expect(runtimeConfig.get().deep_daily_cap).toBe(10);
  });

  it.each(['yes', '1', '', 'TRUE '])('SPEC-FB-07: boolean value %j keeps default', async (bad) => {
    const initFirebase = await load();
    const { runtimeConfig } = initFirebase(env);
    remote = { cloud_enabled: bad };
    expect(runtimeConfig.get().cloud_enabled).toBe(true);
  });

  it('SPEC-FB-07: unknown keys are ignored; empty string for a string key keeps default', async () => {
    const initFirebase = await load();
    const { runtimeConfig } = initFirebase(env);
    remote = { mystery: 'x', deep_model: '' };
    const v = runtimeConfig.get();
    expect(v).toEqual(DEFAULT_RUNTIME_VALUES);
    expect('mystery' in v).toBe(false);
  });

  it('SPEC-FB-07: get() returns a fresh snapshot each time', async () => {
    const initFirebase = await load();
    const { runtimeConfig } = initFirebase(env);
    const a = runtimeConfig.get();
    a.size_tolerance_pct = 99;
    expect(runtimeConfig.get().size_tolerance_pct).toBe(8);
  });
});

describe('remoteconfig.template.json', () => {
  it('SPEC-FB-08: template keys, defaults and value types equal DEFAULT_RUNTIME_VALUES', () => {
    const tpl = JSON.parse(readFileSync(join(ROOT, 'remoteconfig.template.json'), 'utf8')) as {
      parameters: Record<string, { defaultValue: { value: string }; valueType: string }>;
    };
    expect(Object.keys(tpl.parameters).sort()).toEqual(Object.keys(DEFAULT_RUNTIME_VALUES).sort());
    for (const [k, v] of Object.entries(DEFAULT_RUNTIME_VALUES)) {
      const p = tpl.parameters[k];
      expect(p?.defaultValue.value, k).toBe(String(v));
      expect(p?.valueType, k).toBe(typeof v === 'boolean' ? 'BOOLEAN' : typeof v === 'number' ? 'NUMBER' : 'STRING');
    }
  });
});
