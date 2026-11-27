import {
  type AiEngine,
  type AiRequest,
  type AiResponse,
  type AiTask,
  CuiError,
  DEFAULT_RUNTIME_VALUES,
  type EngineStatus,
  type ErrorCode,
} from '@kernel';

// SPEC-TEST-01, SPEC-AI-12: the E2E-only AI seam. Implements the kernel `AiEngine` port with scripted status, canned
// JSON per task, `calls[]`, SDK-like engine selection and the SPEC-AI-02 guards. Imports the kernel only. Loaded by
// `app/compose.ts` through dynamic `import()` behind `import.meta.env.VITE_E2E` and absent from production builds
// (SPEC-TEST-02). E2E tests configure it through `window.__CUI_FAKE__` (`page.addInitScript`) and read `calls`.

/** SPEC §7.2 status scenarios. Offline is a modifier (`FakeAiConfig.online`), not a scenario. */
export const STATUS_SCENARIOS = {
  'available+image': { device: 'available', deviceImage: true, online: true, cloud: 'enabled' },
  'available-text-only': {
    device: 'available',
    deviceImage: false,
    reason: 'image-flag-off',
    online: true,
    cloud: 'enabled',
  },
  downloadable: { device: 'downloadable', deviceImage: true, online: true, cloud: 'enabled' },
  downloading: { device: 'downloading', deviceImage: true, downloadProgress: 0.4, online: true, cloud: 'enabled' },
  'unavailable-not-desktop-chrome': {
    device: 'unavailable',
    deviceImage: false,
    reason: 'not-desktop-chrome',
    online: true,
    cloud: 'enabled',
  },
  'unavailable-image-flag-off': {
    device: 'unavailable',
    deviceImage: false,
    reason: 'image-flag-off',
    online: true,
    cloud: 'enabled',
  },
} as const satisfies Record<string, EngineStatus>;

export type StatusScenario = keyof typeof STATUS_SCENARIOS;

/** One canned answer: any value, a function of the request, or `{ sequence: [...] }` consumed in order (the last repeats). */
export type CannedOutput = unknown;

export interface FakeAiConfig {
  /** A scenario name, or a partial status laid over `available+image`. Read live on every call. */
  status?: StatusScenario | Partial<EngineStatus>;
  /** Offline modifier (`context.setOffline` analogue); overrides the scenario's `online`. */
  online?: boolean;
  outputs?: Partial<Record<AiTask, CannedOutput>>;
  /** Throws `CuiError(code)` for that task, after the guards. */
  errors?: Partial<Record<AiTask, ErrorCode>>;
  durationMs?: number;
  /** Real milliseconds the fake waits before answering or failing (slow cloud). */
  delayMs?: number;
  /** What the SDK would report as `inferenceSource` (to prove guard SPEC-AI-02 (b)). Default: the selected engine. */
  inferenceSource?: 'on-device' | 'cloud';
  /** Published by the engine: every request, rejected ones included. Same array as `FakeAiEngine.calls`. */
  calls?: AiRequest[];
}

/** Default canned outputs, valid against the kernel task schemas and free of numbers (SPEC-KERNEL-08). */
export const DEFAULT_FAKE_OUTPUTS: Record<AiTask, unknown> = {
  'extract-contract': {
    requirements: [
      {
        category: 'presence',
        statement: 'The primary call to action is present',
        condition: 'A button with the call to action text is visible',
        checkKind: 'presence',
        box_2d: [600, 100, 680, 300],
        matchHint: { tag: 'button' },
        primary: true,
      },
    ],
  },
  'infer-responsive': {
    items: [
      {
        fromRequirementId: 'R-01',
        checkKind: 'visible',
        statement: 'The primary action stays visible',
        condition: 'The primary action is inside the viewport width',
      },
    ],
  },
  judge: {
    verdict: 'fail',
    confidence: 'medium',
    explanation: 'The hero image looks cropped compared with the design.',
    suggestedFix: 'Let the hero image scale to its container.',
  },
  'deep-analysis': { items: [] },
};

type Host = { __CUI_FAKE__?: FakeAiConfig };

export class FakeAiEngine implements AiEngine {
  readonly calls: AiRequest[];
  private readonly sequenceIndex = new Map<AiTask, number>();

  constructor(private readonly config: FakeAiConfig) {
    this.calls = config.calls ?? [];
    config.calls = this.calls;
  }

  async status(): Promise<EngineStatus> {
    return this.currentStatus();
  }

  async downloadDeviceModel(onProgress: (p01: number) => void): Promise<EngineStatus> {
    const current = this.currentStatus();
    if (current.device === 'unavailable') throw new CuiError('DEVICE_UNAVAILABLE');
    for (const p of [0.25, 0.5, 0.75, 1]) onProgress(p);
    this.config.status = 'available+image';
    return this.currentStatus();
  }

  async run(req: AiRequest, signal?: AbortSignal): Promise<AiResponse> {
    this.calls.push(structuredClone(req));
    if (signal?.aborted) throw new CuiError('AI_FAILED', 'aborted');
    const status = this.currentStatus();
    const cloudCapable = req.mode !== 'ONLY_ON_DEVICE';

    // SPEC-AI-02 (a): any cloud-capable mode needs a matching consent token; deep-analysis needs the deep scope.
    if (cloudCapable) {
      const scope = req.consent?.scope;
      if (!scope) throw new CuiError('CONSENT_REQUIRED');
      if (req.task === 'deep-analysis' && scope !== 'deep') throw new CuiError('CONSENT_REQUIRED');
    }

    // SPEC-AI-09: cloud switch and connectivity.
    const deviceUsable = status.device === 'available' && (req.images.length === 0 || status.deviceImage === true);
    if (cloudCapable) {
      if (status.cloud === 'disabled') throw new CuiError('CLOUD_DISABLED');
      const wantsCloud = req.mode === 'ONLY_IN_CLOUD' || !deviceUsable;
      if (!status.online && wantsCloud) throw new CuiError('OFFLINE');
    }

    // Engine selection mimics the SDK (SPEC §7.2).
    let engine: 'on-device' | 'cloud';
    if (req.mode === 'ONLY_ON_DEVICE') {
      // SPEC-AI-02 (c): never run unless the device is available.
      if (status.device === 'downloading') throw new CuiError('DEVICE_DOWNLOADING');
      if (status.device !== 'available') throw new CuiError('DEVICE_UNAVAILABLE');
      if (!deviceUsable) throw new CuiError('DEVICE_NO_IMAGE');
      engine = 'on-device';
    } else if (req.mode === 'PREFER_ON_DEVICE') {
      engine = deviceUsable ? 'on-device' : 'cloud';
    } else {
      engine = 'cloud';
    }

    // SPEC-AI-02 (b): an ONLY_ON_DEVICE result the SDK did not mark on-device is discarded.
    const reported = this.config.inferenceSource ?? engine;
    if (req.mode === 'ONLY_ON_DEVICE' && reported !== 'on-device') throw new CuiError('AI_FAILED');
    engine = reported;

    if (this.config.delayMs) await new Promise((r) => setTimeout(r, this.config.delayMs));
    const scripted = this.config.errors?.[req.task];
    if (scripted) throw new CuiError(scripted);

    return {
      json: structuredClone(this.nextOutput(req)),
      engine,
      model: engine === 'on-device' ? 'fake-on-device' : this.cloudModel(req.task),
      durationMs: this.config.durationMs ?? 1,
      bytesSent: engine === 'cloud' ? payloadBytes(req) : 0,
      requestedMode: req.mode,
    };
  }

  private currentStatus(): EngineStatus {
    const s = this.config.status;
    const base: EngineStatus =
      typeof s === 'string' ? { ...STATUS_SCENARIOS[s] } : { ...STATUS_SCENARIOS['available+image'], ...s };
    if (this.config.online !== undefined) base.online = this.config.online;
    return base;
  }

  private cloudModel(task: AiTask): string {
    return task === 'deep-analysis' ? DEFAULT_RUNTIME_VALUES.deep_model : DEFAULT_RUNTIME_VALUES.cloud_first_pass_model;
  }

  private nextOutput(req: AiRequest): unknown {
    const canned = this.config.outputs?.[req.task];
    if (canned === undefined) return DEFAULT_FAKE_OUTPUTS[req.task];
    if (typeof canned === 'function') return (canned as (r: AiRequest) => unknown)(req);
    if (isSequence(canned)) {
      const i = this.sequenceIndex.get(req.task) ?? 0;
      this.sequenceIndex.set(req.task, i + 1);
      return canned.sequence[Math.min(i, canned.sequence.length - 1)];
    }
    return canned;
  }
}

function isSequence(v: unknown): v is { sequence: unknown[] } {
  return typeof v === 'object' && v !== null && Array.isArray((v as { sequence?: unknown }).sequence);
}

/** SPEC-AI-04: UTF-8 byte length of `JSON.stringify({ system, user, images })`. */
function payloadBytes(req: AiRequest): number {
  return new TextEncoder().encode(JSON.stringify({ system: req.system, user: req.user, images: req.images })).length;
}

/**
 * Builds the fake. Without a config it adopts `host.__CUI_FAKE__` (default `globalThis`), creating it when absent, so
 * Playwright can set it with `addInitScript` before load and read `calls` afterwards.
 */
export function createFakeAiEngine(config?: FakeAiConfig, host: Host = globalThis as Host): FakeAiEngine {
  const cfg = config ?? host.__CUI_FAKE__ ?? {};
  host.__CUI_FAKE__ = cfg;
  return new FakeAiEngine(cfg);
}
