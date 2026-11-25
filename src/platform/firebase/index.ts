import type { RuntimeConfig } from '@kernel';
import type { FirebaseApp } from 'firebase/app';

// Public API of platform/firebase (SPEC §4.2.1). Bodies: lane A (task 5.x).

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

export function initFirebase(_env: FirebaseEnv): { app: FirebaseApp; runtimeConfig: RuntimeConfig } {
  throw new Error('not implemented');
}
