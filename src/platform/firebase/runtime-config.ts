import { DEFAULT_RUNTIME_VALUES, type RuntimeConfig, type RuntimeValues, RuntimeValuesSchema } from '@kernel';
import { fetchAndActivate, getAll, type RemoteConfig } from 'firebase/remote-config';

// SPEC-FB-06, SPEC-FB-07: Remote Config values are public and untrusted; each key is parsed on its own.

export const MIN_FETCH_INTERVAL_MS = 3_600_000;

type Shape = typeof RuntimeValuesSchema.shape;

function parseOne<K extends keyof Shape>(key: K, raw: string): RuntimeValues[K] | undefined {
  const sample = DEFAULT_RUNTIME_VALUES[key];
  let candidate: unknown = raw;
  if (typeof sample === 'number') {
    candidate = raw.trim() === '' ? Number.NaN : Number(raw);
  } else if (typeof sample === 'boolean') {
    candidate = raw === 'true' ? true : raw === 'false' ? false : undefined;
  } else if (raw === '') {
    return undefined;
  }
  const r = RuntimeValuesSchema.shape[key].safeParse(candidate);
  return r.success ? (r.data as RuntimeValues[K]) : undefined;
}

export function createRuntimeConfig(rc: RemoteConfig): RuntimeConfig {
  return {
    get(): RuntimeValues {
      const out: RuntimeValues = { ...DEFAULT_RUNTIME_VALUES };
      let all: ReturnType<typeof getAll> = {};
      try {
        all = getAll(rc);
      } catch {
        return out;
      }
      for (const key of Object.keys(DEFAULT_RUNTIME_VALUES) as (keyof RuntimeValues)[]) {
        const value = all[key];
        if (!value) continue;
        const parsed = parseOne(key, value.asString());
        if (parsed !== undefined) (out as Record<string, unknown>)[key] = parsed;
      }
      return out;
    },
    async refresh(): Promise<void> {
      try {
        await fetchAndActivate(rc);
      } catch {
        // SPEC-FB-02: fetch and throttle errors never surface.
      }
    },
  };
}
