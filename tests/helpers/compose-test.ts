import type { SampleAssets } from '@demo';
import type { AiEngine, Clock, Ids, ImageCodec, RuntimeConfig } from '@kernel';
import { DEFAULT_RUNTIME_VALUES } from '@kernel';
import { openStorage } from '@store';
import { buildServices, type StorageSet } from '../../src/app/compose';
import type { Services } from '../../src/app/services';
import { createFakeAiEngine } from '../../src/app/testing/fake-ai-engine';

// SPEC-APP-01: `composeForTest()` builds the same graph as `compose` with the FakeAiEngine, the storage adapter
// (tests load `fake-indexeddb/auto` first) and the inline measure client. Never imported by the app entry.

export interface TestComposition {
  services: Services;
  storage: StorageSet;
}

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = () => resolve();
    r.onerror = () => resolve();
    r.onblocked = () => resolve();
  });
}

export interface ComposeOverrides {
  ai?: AiEngine;
  config?: RuntimeConfig;
  /** In-memory or other ports instead of the IndexedDB adapter. */
  storage?: StorageSet;
  /** A codec for jsdom, where the browser codec cannot decode. */
  codec?: ImageCodec;
  sample?: () => Promise<SampleAssets>;
  clock?: Clock;
  ids?: Ids;
}

export async function composeForTest(over: ComposeOverrides = {}): Promise<TestComposition> {
  // A fresh database per call keeps compositions isolated.
  if (!over.storage) for (const d of await indexedDB.databases()) if (d.name) await deleteDb(d.name);
  const storage = over.storage ?? (await openStorage());
  const config: RuntimeConfig = over.config ?? { get: () => DEFAULT_RUNTIME_VALUES, refresh: async () => undefined };
  const ai = over.ai ?? createFakeAiEngine({}, {});
  return {
    services: buildServices({
      storage,
      ai,
      config,
      ...(over.codec && { codec: over.codec }),
      ...(over.sample && { sample: over.sample }),
      ...(over.clock && { clock: over.clock }),
      ...(over.ids && { ids: over.ids }),
    }),
    storage,
  };
}
