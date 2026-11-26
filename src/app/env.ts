import type { FirebaseEnv } from '@fb';
import { z } from 'zod';

// SPEC-APP-06, SPEC-DEPLOY-02: `VITE_*` validated with zod. All values are public configuration.

export interface AppEnv {
  e2e: boolean;
  appVersion: string;
  /** Present only when every Firebase variable is set. */
  firebase?: FirebaseEnv;
}

export type EnvResult = { ok: true; env: AppEnv } | { ok: false; issues: string[]; env: AppEnv };

const required = z.string().min(1);
const flag = (v: unknown) => v === '1' || v === 'true';

const FirebaseVars = z.object({
  VITE_FIREBASE_API_KEY: required,
  VITE_FIREBASE_AUTH_DOMAIN: required,
  VITE_FIREBASE_PROJECT_ID: required,
  VITE_FIREBASE_APP_ID: required,
  VITE_FIREBASE_MESSAGING_SENDER_ID: required,
  VITE_RECAPTCHA_ENTERPRISE_KEY: required,
});

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** Dev callers throw on `ok: false`; production shows "Configuration error" and keeps the deterministic engine usable. */
export function parseEnv(raw: Record<string, unknown>): EnvResult {
  const e2e = raw.VITE_E2E === '1';
  const base = { e2e, appVersion: str(raw.VITE_APP_VERSION) ?? 'dev' };
  const parsed = FirebaseVars.safeParse(raw);
  if (!parsed.success) {
    // With VITE_E2E=1 the Firebase variables are optional (SPEC-APP-06).
    if (e2e) return { ok: true, env: base };
    const issues = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].map((name) => `${name} is missing`);
    return { ok: false, issues, env: base };
  }
  const v = parsed.data;
  const token = str(raw.VITE_APPCHECK_DEBUG_TOKEN);
  const firebase: FirebaseEnv = {
    apiKey: v.VITE_FIREBASE_API_KEY,
    authDomain: v.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: v.VITE_FIREBASE_PROJECT_ID,
    appId: v.VITE_FIREBASE_APP_ID,
    messagingSenderId: v.VITE_FIREBASE_MESSAGING_SENDER_ID,
    recaptchaEnterpriseKey: v.VITE_RECAPTCHA_ENTERPRISE_KEY,
    appCheckDebug: flag(raw.VITE_APPCHECK_DEBUG),
    ...(token ? { appCheckDebugToken: token } : {}),
  };
  return { ok: true, env: { ...base, firebase } };
}

/** The build's own environment. */
export const appEnv = (): EnvResult => parseEnv(import.meta.env as Record<string, unknown>);
