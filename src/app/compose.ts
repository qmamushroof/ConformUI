import type { ContractDeps } from '@contract';
import { createContractService } from '@contract';
import { createDeepService } from '@deep';
import type { FirebaseEnv } from '@fb';
import { createImageCodec } from '@imaging';
import type { AiEngine, BlobStore, Clock, Ids, ProjectStore, RuntimeConfig, SettingsStore } from '@kernel';
import { inlineMeasureClient } from '@measure';
import { createProjectsService } from '@projects';
import { createRunService } from '@run';
import { createSettingsService } from '@settings';
import { openStorage } from '@store';
import type { AppEnv } from './env';
import { createLazyAiEngine, createLazyRuntimeConfig } from './lazy-engine';
import type { Services } from './services';

// SPEC-APP-01: composition root. Storage, codec, inline measure client, then services over a lazy AiEngine proxy.
// Firebase (`@fb`, `@ai`) loads through dynamic import after first paint (`startEngine`). With VITE_E2E the fake
// engine and the static defaults replace Firebase entirely (SPEC-TEST-01).

export interface StorageSet {
  projects: ProjectStore;
  blobs: BlobStore;
  settings: SettingsStore;
}

export interface Loaded {
  ai: AiEngine;
  config: RuntimeConfig;
}

export interface ComposeOptions {
  storage?: () => Promise<StorageSet>;
  /** E2E only; the default loads the test seam behind `import.meta.env.VITE_E2E`. */
  loadFake?: () => Promise<AiEngine | undefined>;
  loadFirebase?: (env: FirebaseEnv) => Promise<Loaded>;
}

export interface Composed {
  services: Services;
  /** Resolves the lazy engine and config. Call after first paint; never rejects. */
  startEngine(): Promise<void>;
}

const systemClock: Clock = { now: () => Date.now() };
const randomIds: Ids = { next: () => crypto.randomUUID() };

/** Run and Deep factories are Step 0 stubs until M3 and throw on construction; defer so composition never fails. */
function lazyService<T extends object>(build: () => T): T {
  let built: T | undefined;
  const get = () => {
    built ??= build();
    return built;
  };
  return new Proxy({} as T, {
    get: (_t, key) => Reflect.get(get(), key),
    has: (_t, key) => Reflect.has(get(), key),
  });
}

export interface GraphInput {
  storage: StorageSet;
  ai: AiEngine;
  config: RuntimeConfig;
  clock?: Clock;
  ids?: Ids;
  onEngineChange?: Services['onEngineChange'];
}

/** The service graph shared by `compose` and `composeForTest`. */
export function buildServices(i: GraphInput): Services {
  const clock = i.clock ?? systemClock;
  const ids = i.ids ?? randomIds;
  const codec = createImageCodec();
  const measure = inlineMeasureClient();
  const { projects: store, blobs, settings: settingsStore } = i.storage;
  const { ai, config } = i;
  const contractDeps: ContractDeps = { ai, config, store, blobs, codec, clock, ids, measure };
  return {
    projects: createProjectsService({ store, blobs, codec, clock, ids }),
    contract: createContractService(contractDeps),
    run: lazyService(() => createRunService({ ai, config, store, blobs, codec, measure, clock, ids })),
    deep: lazyService(() => createDeepService({ ai, config, store, blobs, codec, settings: settingsStore, clock })),
    settings: createSettingsService({ store: settingsStore, ai, projects: store, clock }),
    store,
    blobs,
    settingsStore,
    codec,
    measure,
    ai,
    config,
    clock,
    ids,
    onEngineChange: i.onEngineChange ?? (() => () => undefined),
  };
}

/** The test seam is only reachable behind this constant condition, so production builds drop it (SPEC-TEST-02). */
async function loadE2eEngine(): Promise<AiEngine | undefined> {
  if (!import.meta.env.VITE_E2E) return undefined;
  const m = await import('./testing/fake-ai-engine');
  return m.createFakeAiEngine();
}

async function loadFirebaseEngine(env: FirebaseEnv): Promise<Loaded> {
  const [fb, ai] = await Promise.all([import('@fb'), import('@ai')]);
  const { app, runtimeConfig } = fb.initFirebase(env);
  return { ai: ai.createAiEngine({ app, config: runtimeConfig, clock: systemClock }), config: runtimeConfig };
}

export async function compose(env: AppEnv, options: ComposeOptions = {}): Promise<Composed> {
  const storage = await (options.storage ?? openStorage)();
  const lazyAi = createLazyAiEngine();
  const lazyConfig = createLazyRuntimeConfig();
  const services = buildServices({
    storage,
    ai: lazyAi.engine,
    config: lazyConfig.config,
    onEngineChange: lazyAi.subscribe,
  });

  const startEngine = async (): Promise<void> => {
    try {
      if (env.e2e) {
        const fake = await (options.loadFake ?? loadE2eEngine)();
        if (fake) {
          lazyConfig.fail(); // static kernel defaults
          lazyAi.resolve(fake);
          return;
        }
      } else if (env.firebase) {
        const loaded = await (options.loadFirebase ?? loadFirebaseEngine)(env.firebase);
        lazyConfig.resolve(loaded.config);
        lazyAi.resolve(loaded.ai);
        return;
      }
    } catch {
      // Falls through: the deterministic engine and the sample stay usable (SPEC-APP-06).
    }
    lazyConfig.fail();
    lazyAi.fail();
  };

  return { services, startEngine };
}
