import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../../src/app/env';

const FULL = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'x.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'x',
  VITE_FIREBASE_APP_ID: '1:2:web:3',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
  VITE_RECAPTCHA_ENTERPRISE_KEY: 'site-key',
};

describe('parseEnv', () => {
  it('SPEC-APP-06: a complete environment yields the Firebase config and no issues', () => {
    const r = parseEnv({ ...FULL, VITE_APP_VERSION: 'abc1234' });
    expect(r.ok).toBe(true);
    expect(r.env.e2e).toBe(false);
    expect(r.env.appVersion).toBe('abc1234');
    expect(r.env.firebase).toMatchObject({ apiKey: 'key', projectId: 'x', recaptchaEnterpriseKey: 'site-key' });
    expect(r.env.firebase?.appCheckDebug).toBe(false);
  });

  it('SPEC-APP-06: a missing Firebase variable is reported by name and leaves no Firebase config', () => {
    const { VITE_FIREBASE_APP_ID: _omit, ...rest } = FULL;
    const r = parseEnv(rest);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.join(' ')).toContain('VITE_FIREBASE_APP_ID');
    expect(r.env.firebase).toBeUndefined();
  });

  it('SPEC-APP-06: empty strings count as missing (unset .env values)', () => {
    const r = parseEnv({ ...FULL, VITE_FIREBASE_API_KEY: '' });
    expect(r.ok).toBe(false);
  });

  it('SPEC-APP-06: with VITE_E2E=1 the Firebase variables are optional', () => {
    const r = parseEnv({ VITE_E2E: '1' });
    expect(r.ok).toBe(true);
    expect(r.env.e2e).toBe(true);
    expect(r.env.firebase).toBeUndefined();
  });

  it('SPEC-APP-06: VITE_E2E set to anything but 1 does not relax validation', () => {
    expect(parseEnv({ VITE_E2E: '0' }).ok).toBe(false);
    expect(parseEnv({ VITE_E2E: '' }).ok).toBe(false);
  });

  it('SPEC-APP-06, SPEC-FB-04: the App Check debug flag and token are read only as strings "1" or "true"', () => {
    const on = parseEnv({ ...FULL, VITE_APPCHECK_DEBUG: 'true', VITE_APPCHECK_DEBUG_TOKEN: 'tok' });
    expect(on.env.firebase?.appCheckDebug).toBe(true);
    expect(on.env.firebase?.appCheckDebugToken).toBe('tok');
    expect(parseEnv({ ...FULL, VITE_APPCHECK_DEBUG: 'yes' }).env.firebase?.appCheckDebug).toBe(false);
  });

  it('SPEC-APP-06: the version falls back to "dev" when not injected', () => {
    expect(parseEnv({ VITE_E2E: '1' }).env.appVersion).toBe('dev');
  });
});
