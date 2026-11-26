import type { AiEngine, RuntimeConfig } from '@kernel';
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

export async function composeForTest(over: { ai?: AiEngine; config?: RuntimeConfig } = {}): Promise<TestComposition> {
  // A fresh database per call keeps compositions isolated.
  for (const d of await indexedDB.databases()) if (d.name) await deleteDb(d.name);
  const storage = await openStorage();
  const config: RuntimeConfig = over.config ?? { get: () => DEFAULT_RUNTIME_VALUES, refresh: async () => undefined };
  const ai = over.ai ?? createFakeAiEngine({}, {});
  return { services: buildServices({ storage, ai, config }), storage };
}
