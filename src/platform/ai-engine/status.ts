import type { Clock, EngineStatus, RuntimeConfig } from '@kernel';
import { CuiError } from '@kernel';
import type { createModelFactory, ModelSpec } from './model-factory';

// SPEC-AI-07, SPEC-AI-03: device status mapping and the model download, both over the runner's model factory.

type Availability = 'available' | 'downloadable' | 'downloading' | 'unavailable';
type DeviceFacts = Pick<EngineStatus, 'device' | 'deviceImage' | 'reason'>;

interface LanguageModelApi {
  availability(options?: unknown): Promise<string>;
}

/** Device facts are re-read at most this often; `refresh()` and a finished download bypass it. */
const DEVICE_TTL_MS = 1_000;
const MIN_CHROME_MAJOR = 139;
const DOWNLOAD_SYSTEM = 'ConformUI on-device model download.';

const TEXT_IO = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};
const IMAGE_IO = {
  expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
  expectedOutputs: TEXT_IO.expectedOutputs,
};

const isAvailability = (v: unknown): v is Availability =>
  v === 'available' || v === 'downloadable' || v === 'downloading' || v === 'unavailable';

/** `undefined` when the browser is desktop Chrome; otherwise the SPEC-AI-07 reason. */
function browserReason(): 'not-desktop-chrome' | 'chrome-too-old' | undefined {
  const nav = (globalThis as { navigator?: Navigator }).navigator as
    | (Navigator & { userAgentData?: { mobile: boolean; brands: { brand: string; version: string }[] } })
    | undefined;
  if (!nav) return 'not-desktop-chrome';
  let major: number | undefined;
  if (nav.userAgentData) {
    if (nav.userAgentData.mobile) return 'not-desktop-chrome';
    const chrome = nav.userAgentData.brands.find((b) => b.brand.includes('Chrome'));
    if (!chrome) return 'not-desktop-chrome';
    major = Number.parseInt(chrome.version, 10);
  } else {
    const ua = nav.userAgent ?? '';
    const m = /Chrome\/(\d+)/.exec(ua);
    if (!m || /Mobile|Android/.test(ua)) return 'not-desktop-chrome';
    major = Number.parseInt(m[1] ?? '', 10);
  }
  return Number.isFinite(major) && major < MIN_CHROME_MAJOR ? 'chrome-too-old' : undefined;
}

async function readAvailability(lm: LanguageModelApi, options: unknown): Promise<Availability | 'error'> {
  try {
    const v = await lm.availability(options);
    return isAvailability(v) ? v : 'error';
  } catch {
    return 'error';
  }
}

async function readDevice(): Promise<DeviceFacts> {
  const env = browserReason();
  if (env) return { device: 'unavailable', deviceImage: false, reason: env };
  const lm = (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;
  if (!lm) return { device: 'unavailable', deviceImage: false, reason: 'no-prompt-api' };

  const text = await readAvailability(lm, TEXT_IO);
  if (text === 'error') return { device: 'unavailable', deviceImage: false, reason: 'unknown' };
  if (text === 'unavailable') return { device: 'unavailable', deviceImage: false, reason: 'hardware' };

  // SPEC-AI-07 verified 2026-11-26: with the multimodal flag off the image query returns 'unavailable' while text
  // stays 'available'; with the flags on both are 'available' (desktop Chrome 158, Gemma 4 on device). The image
  // query is therefore a reliable signal; a thrown error still maps to 'unknown' as a defensive branch.
  const image = await readAvailability(lm, IMAGE_IO);
  if (image === 'error') return { device: text, deviceImage: 'unknown' };
  if (image === 'unavailable') return { device: text, deviceImage: false, reason: 'image-flag-off' };
  return { device: text, deviceImage: true };
}

export function createDeviceService(d: {
  config: RuntimeConfig;
  clock: Clock;
  factory: ReturnType<typeof createModelFactory>;
  online?: () => boolean;
}) {
  const isOnline =
    d.online ??
    (() => {
      const nav = (globalThis as { navigator?: Navigator }).navigator;
      return nav ? nav.onLine !== false : true;
    });

  let cached: { at: number; facts: Promise<DeviceFacts> } | undefined;
  let inflight: Promise<EngineStatus> | undefined;
  let progress: number | undefined;
  const listeners = new Set<(p: number) => void>();

  function facts(): Promise<DeviceFacts> {
    const now = d.clock.now();
    if (!cached || now - cached.at >= DEVICE_TTL_MS || now < cached.at) cached = { at: now, facts: readDevice() };
    return cached.facts;
  }

  async function compose(): Promise<EngineStatus> {
    const f = await facts();
    const s: EngineStatus = {
      ...f,
      online: isOnline(),
      cloud: d.config.get().cloud_enabled ? 'enabled' : 'disabled',
    };
    if (inflight && f.device === 'downloading' && progress !== undefined) s.downloadProgress = progress;
    return s;
  }

  function status(): Promise<EngineStatus> {
    return compose();
  }

  function refresh(): Promise<EngineStatus> {
    cached = undefined;
    return compose();
  }

  /** The one `ONLY_ON_DEVICE` spec used for the download; it goes through the shared factory (SPEC-AI-03). */
  function downloadSpec(hasImages: boolean): ModelSpec {
    return {
      mode: 'ONLY_ON_DEVICE',
      task: 'judge',
      system: DOWNLOAD_SYSTEM,
      promptVersion: 'device-download',
      hasImages,
    };
  }

  function emit(raw: number): void {
    if (!Number.isFinite(raw)) return;
    progress = Math.min(1, Math.max(0, raw));
    for (const l of listeners) {
      try {
        l(progress);
      } catch {
        // A faulty UI callback must not break the download.
      }
    }
  }

  async function runDownload(): Promise<EngineStatus> {
    try {
      const before = await refresh();
      if (before.device === 'unavailable') throw new CuiError('DEVICE_UNAVAILABLE');
      if (before.device === 'available') return before;
      progress = 0;
      const { model } = d.factory.get(downloadSpec(before.deviceImage === true));
      await model.initializeDeviceModel(emit);
      return await refresh();
    } catch (e) {
      throw e instanceof CuiError ? e : new CuiError('DEVICE_UNAVAILABLE', undefined, { cause: e });
    } finally {
      progress = undefined;
      inflight = undefined;
      cached = undefined;
    }
  }

  function download(onProgress: (p01: number) => void): Promise<EngineStatus> {
    listeners.add(onProgress);
    inflight ??= runDownload();
    return inflight.finally(() => listeners.delete(onProgress));
  }

  return { status, refresh, download, downloadSpec };
}
