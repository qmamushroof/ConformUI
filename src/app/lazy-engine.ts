import {
  type AiEngine,
  type AiRequest,
  CuiError,
  DEFAULT_RUNTIME_VALUES,
  type EngineStatus,
  type RuntimeConfig,
} from '@kernel';

// SPEC-APP-01: the services are built before Firebase loads, so they get proxies that resolve after first paint.

type Listener = () => void;

export interface LazyAiEngine {
  engine: AiEngine;
  resolve(e: AiEngine): void;
  /** The real engine will never arrive (load failed or no configuration): runs reject, status stays unavailable. */
  fail(): void;
  resolved(): boolean;
  subscribe(l: Listener): () => void;
}

const browserOnline = () =>
  typeof navigator === 'undefined' || navigator.onLine === undefined ? true : navigator.onLine;

function settle() {
  let done: (v: 'ok' | 'failed') => void = () => undefined;
  const promise = new Promise<'ok' | 'failed'>((r) => {
    done = r;
  });
  return { promise, done };
}

export function createLazyAiEngine(isOnline: () => boolean = browserOnline): LazyAiEngine {
  let real: AiEngine | undefined;
  let failed = false;
  const gate = settle();
  const listeners = new Set<Listener>();
  const notify = () => {
    for (const l of [...listeners]) l();
  };

  const wait = async (signal?: AbortSignal): Promise<AiEngine> => {
    if (real) return real;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const abort = new Promise<never>((_, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    const outcome = await Promise.race([gate.promise, abort]);
    if (outcome === 'failed' || !real) throw new CuiError('AI_FAILED', 'The AI engine did not load');
    return real;
  };

  const before = (): EngineStatus => ({
    device: 'unavailable',
    deviceImage: 'unknown',
    reason: 'unknown',
    online: isOnline(),
    cloud: 'disabled',
  });

  const engine: AiEngine = {
    status: async () => (real ? real.status() : before()),
    downloadDeviceModel: async (onProgress) => (await wait()).downloadDeviceModel(onProgress),
    run: async (req: AiRequest, signal?: AbortSignal) => (await wait(signal)).run(req, signal),
  };

  return {
    engine,
    resolve(e) {
      if (real || failed) return;
      real = e;
      gate.done('ok');
      notify();
    },
    fail() {
      if (real || failed) return;
      failed = true;
      gate.done('failed');
      notify();
    },
    resolved: () => real !== undefined,
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

export interface LazyRuntimeConfig {
  config: RuntimeConfig;
  resolve(c: RuntimeConfig): void;
  fail(): void;
}

/** Static kernel defaults until the Remote Config wrapper arrives (SPEC-FB-01 keeps defaults synchronous). */
export function createLazyRuntimeConfig(): LazyRuntimeConfig {
  let real: RuntimeConfig | undefined;
  const gate = settle();
  return {
    config: {
      get: () => real?.get() ?? DEFAULT_RUNTIME_VALUES,
      refresh: async () => {
        await gate.promise;
        await real?.refresh();
      },
    },
    resolve(c) {
      if (real) return;
      real = c;
      gate.done('ok');
    },
    fail() {
      gate.done('failed');
    },
  };
}
