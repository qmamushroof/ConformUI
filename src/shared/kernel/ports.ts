import type { Letterbox, PairLayout } from './letterbox';
import type { RuntimeValues, Thresholds } from './runtime-values';
import type {
  AiMode,
  ConsentToken,
  Contract,
  DomElement,
  DomSnapshot,
  ElementMatcher,
  ImageRef,
  Oklab,
  Project,
  Rect,
  Run,
  Settings,
  ViewportId,
} from './types';

// SPEC §4.1.3 ports (implemented in platform/* or features/measure, injected by app)

export type AiTask = 'extract-contract' | 'infer-responsive' | 'judge' | 'deep-analysis';
export interface AiImage {
  mime: 'image/jpeg' | 'image/png';
  base64: string;
  bytes: number;
  role: 'design' | 'capture' | 'pair';
}
export interface AiRequest {
  task: AiTask;
  mode: AiMode;
  system: string;
  user: string;
  images: AiImage[];
  promptVersion: string;
  allowedNumbers: number[] /*SPEC-KERNEL-08*/;
  consent?: ConsentToken;
}
export interface AiResponse {
  json: unknown;
  engine: 'on-device' | 'cloud' /*from inferenceSource*/;
  model: string;
  durationMs: number;
  bytesSent: number /*0 when on-device*/;
  requestedMode: AiMode;
}
export interface EngineStatus {
  device: 'available' | 'downloadable' | 'downloading' | 'unavailable';
  deviceImage: boolean | 'unknown';
  reason?: 'no-prompt-api' | 'not-desktop-chrome' | 'chrome-too-old' | 'image-flag-off' | 'hardware' | 'unknown';
  downloadProgress?: number;
  online: boolean;
  cloud: 'enabled' | 'disabled';
}
export interface AiEngine {
  status(): Promise<EngineStatus>;
  downloadDeviceModel(onProgress: (p01: number) => void): Promise<EngineStatus>;
  run(req: AiRequest, signal?: AbortSignal): Promise<AiResponse>; // throws CuiError
}
export interface RuntimeConfig {
  get(): RuntimeValues;
  refresh(): Promise<void>;
} // §4.1.6
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
export interface ImageCodec {
  normalise(file: Blob, cssWidth: number): Promise<{ blob: Blob; ref: Omit<ImageRef, 'blobId'> }>;
  pixels(blob: Blob): Promise<RgbaImage>;
  /** `letterbox`: draw on a square canvas with neutral padding (on-device input, SPEC-AI-11); the result says where. */
  crop(
    blob: Blob,
    r: Rect,
    maxSide: number,
    mime: 'image/jpeg' | 'image/png',
    opts?: { letterbox?: boolean },
  ): Promise<AiImage & { blob: Blob; letterbox?: Letterbox }>;
  /** Design left, capture right; with `letterbox` a pair wider than 2:1 is stacked (design on top) in a square canvas. */
  composePair(
    design: Blob,
    dr: Rect,
    capture: Blob,
    cr: Rect,
    maxSide: number,
    opts?: { letterbox?: boolean },
  ): Promise<AiImage & { layout?: PairLayout }>;
  probe(file: Blob): Promise<{ width: number; height: number; mime: string }>; // source size, no resample (SPEC-MEAS-04)
}
export interface ImageMeta {
  width: number;
  height: number;
  cssWidth: number;
}
export interface Alignment {
  ok: boolean;
  widthDeltaPct: number;
  heightDesign: number;
  heightCapture: number;
  issues: ('width-mismatch' | 'height-differs')[];
}
export interface MeasureApi {
  // pure; implemented by features/measure as `measureApi` (§4.4)
  align(design: ImageMeta, capture: ImageMeta & { dom?: DomSnapshot }, t: Thresholds): Alignment;
  snapRegion(img: RgbaImage, suggested: Rect, t: Thresholds): { rect: Rect; iou: number } | { unresolved: true };
  locateOnCapture(design: RgbaImage, dr: Rect, capture: RgbaImage, t: Thresholds): { rect: Rect; score: number };
  regionDiff(
    design: RgbaImage,
    dr: Rect,
    capture: RgbaImage,
    cr: Rect,
    t: Thresholds,
  ): { diffRatio: number; diffMask: Uint8ClampedArray };
  inkRatio(img: RgbaImage, r: Rect): number;
  dominantColour(img: RgbaImage, r: Rect, property: 'background' | 'text'): Oklab;
  deltaE(a: Oklab, b: Oklab): number;
  matchElements(dom: DomSnapshot, m: ElementMatcher, region?: Rect): DomElement[];
  overflowFacts(dom: DomSnapshot): { horizontalPx: number; beyondViewport: DomElement[]; clipped: DomElement[] };
  overlaps(dom: DomSnapshot): [DomElement, DomElement, Rect][];
  pct(design: number, observed: number): number; // signed %, 1 decimal
}
export type MeasureClient = {
  [K in keyof MeasureApi]: (...a: Parameters<MeasureApi[K]>) => Promise<ReturnType<MeasureApi[K]>>;
};
export interface ProjectStore {
  put(p: Project): Promise<void>;
  get(id: string): Promise<Project | undefined>;
  list(): Promise<Project[]>;
  remove(id: string): Promise<void> /*cascade*/;
  putContract(c: Contract): Promise<void>;
  getContract(id: string): Promise<Contract | undefined>;
  putRun(r: Run): Promise<void>;
  getRun(id: string): Promise<Run | undefined>;
  listRuns(projectId: string): Promise<Run[]>;
  clearAll(): Promise<void>;
}
export interface BlobStore {
  put(blob: Blob): Promise<string>;
  get(id: string): Promise<Blob | undefined>;
  remove(id: string): Promise<void>;
}
export interface SettingsStore {
  read(): Promise<Settings>;
  write(s: Partial<Settings>): Promise<void>;
}
export interface Clock {
  now(): number;
}
export interface Ids {
  next(): string;
}
export interface SendList {
  images: { label: string; bytes: number }[];
  text: string[];
} // consent sheet (PRD-H-05); used by contract, run, settings
export interface RunSummary {
  id: string;
  createdAt: number;
  contractVersion: number;
  viewports: ViewportId[];
  pass: number;
  fail: number;
  review: number;
}
