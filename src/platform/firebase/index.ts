import type { RuntimeConfig } from '@kernel';
import { DEFAULT_RUNTIME_VALUES } from '@kernel';
import { type FirebaseApp, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getRemoteConfig } from 'firebase/remote-config';
import { createRuntimeConfig, MIN_FETCH_INTERVAL_MS } from './runtime-config';

// Public API of platform/firebase (SPEC §4.2.1).

export type { FirebaseApp } from 'firebase/app';

export interface FirebaseEnv {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
  recaptchaEnterpriseKey: string;
  appCheckDebug: boolean;
  appCheckDebugToken?: string;
}

export function initFirebase(env: FirebaseEnv): { app: FirebaseApp; runtimeConfig: RuntimeConfig } {
  // SPEC-FB-01: app, App Check, Remote Config defaults (sync), then a background fetch that is never awaited.
  const app = initializeApp({
    apiKey: env.apiKey,
    authDomain: env.authDomain,
    projectId: env.projectId,
    appId: env.appId,
    messagingSenderId: env.messagingSenderId,
  });

  // SPEC-FB-04: development only; the branch is removed from production builds.
  if (import.meta.env.DEV && env.appCheckDebug) {
    (globalThis as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = env.appCheckDebugToken || true;
  }
  // SPEC-FB-03
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.recaptchaEnterpriseKey),
    isTokenAutoRefreshEnabled: true,
  });

  // SPEC-FB-06
  const rc = getRemoteConfig(app);
  rc.settings.minimumFetchIntervalMillis = MIN_FETCH_INTERVAL_MS;
  rc.defaultConfig = { ...DEFAULT_RUNTIME_VALUES };
  const runtimeConfig = createRuntimeConfig(rc);
  void runtimeConfig.refresh(); // SPEC-FB-02: never blocks, never throws
  return { app, runtimeConfig };
}
