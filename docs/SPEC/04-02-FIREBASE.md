# 4.2 firebase

**[◀ 4.1 kernel](04-01-KERNEL.md)** · [SPEC index](../SPEC.md) · **[4.3 ai-engine ▶](04-03-AI-ENGINE.md)**

`src/platform/firebase`. Owns the single `FirebaseApp`, App Check and Remote Config (PRD-D-06, PRD-H-07, PRD-H-08).

## 4.2.1 Public API

```ts
export interface FirebaseEnv { apiKey: string; authDomain: string; projectId: string; appId: string; messagingSenderId: string;
  recaptchaEnterpriseKey: string; appCheckDebug: boolean; appCheckDebugToken?: string }
export function initFirebase(env: FirebaseEnv): { app: FirebaseApp; runtimeConfig: RuntimeConfig };   // RuntimeConfig = kernel port
```

Only `app/compose.ts` imports `@fb`, via dynamic `import()` (`SPEC-APP-01`); nothing static-imports it, so `firebase/*` stays out of the initial bundle (`SPEC-PERF-04`). `RuntimeValuesSchema`, `Thresholds` and `DEFAULT_RUNTIME_VALUES` live in the kernel (§4.1.6).

Errors: invalid env → thrown at startup (`app/env.ts` validates first, §8.2). Remote Config failures never throw.

## 4.2.2 Init order and App Check

| ID | Rule |
|---|---|
| `SPEC-FB-01` | Order: `initializeApp(config)` → App Check → Remote Config defaults (sync) → background `fetchAndActivate()`; the app never waits for the fetch (`SPEC-FB-02`). `ai-engine` calls `getAI` only after App Check is initialised. `firebase/*` is loaded by dynamic `import()` after first paint (`SPEC-PERF-04`); the deterministic engine and local data work before it resolves. |
| `SPEC-FB-02` | Remote Config never blocks: before and without a successful fetch the app runs on kernel `DEFAULT_RUNTIME_VALUES`; fetch and throttle errors are swallowed (`SPEC-FB-07`). |
| `SPEC-FB-03` | Production provider: **reCAPTCHA Enterprise** (`ReCaptchaEnterpriseProvider(VITE_RECAPTCHA_ENTERPRISE_KEY)`), score-based Web key, `isTokenAutoRefreshEnabled: true` (S5). |
| `SPEC-FB-04` | Debug provider only when `import.meta.env.DEV && VITE_APPCHECK_DEBUG === '1'`: set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = VITE_APPCHECK_DEBUG_TOKEN \|\| true` **before** `initializeAppCheck` (per hybrid get-started doc). The branch is dead-code-eliminated in production; a build test greps `dist/` for `FIREBASE_APPCHECK_DEBUG_TOKEN` → absent. Tokens never committed; `localhost` is not added to reCAPTCHA domains. |
| `SPEC-FB-05` | App Check enforcement applies to AI Logic (enabled in the console from day 1 of development); Remote Config is not enforced. A rejected token surfaces as `APPCHECK_FAILED`. CI never needs a debug token (E2E uses `FakeAiEngine`). |

```ts
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG === '1')
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(key), isTokenAutoRefreshEnabled: true });
```

## 4.2.3 Remote Config (`SPEC-FB-06`)

`minimumFetchIntervalMillis = 3_600_000`. `setDefaults` uses kernel `DEFAULT_RUNTIME_VALUES` so the app works offline and before the first fetch. Keys, defaults and clamps: §4.1.6. Values are public: nothing secret.

`SPEC-FB-07`: `RuntimeConfig.get()` returns a snapshot parsed with kernel `RuntimeValuesSchema`; invalid or out-of-range remote values are ignored key by key (default kept); `getValue` is confined to this module; fetch/throttle errors are swallowed. Threshold keys form `Thresholds` (kernel) and are copied into each Run.

`SPEC-FB-08`: `remoteconfig.template.json` is committed; the owner publishes it manually (console import or `firebase deploy --only remoteconfig`, §8.3). A unit test asserts the template keys/defaults equal `DEFAULT_RUNTIME_VALUES`.

## 4.2.4 Acceptance tests

- Test for `SPEC-FB-04`: production build output contains no assignment to `FIREBASE_APPCHECK_DEBUG_TOKEN`; the SDK's own read of that global is allowed.
- Test for `SPEC-FB-07`: remote `size_tolerance_pct="abc"` and `"500"` both yield default `8`; valid `"10"` yields `10`.
- Test for `SPEC-FB-08`: template ↔ defaults parity.
