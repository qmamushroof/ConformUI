# 4.1 kernel

**[◀ 3. Architecture](03-ARCHITECTURE.md)** · [SPEC index](../SPEC.md) · **[4.2 firebase ▶](04-02-FIREBASE.md)**

`src/shared/kernel`. Pure TypeScript + zod: domain types, ports, schemas, runtime values, consent, mode resolution, pure helpers, errors, limits. Frozen first (build step 0, §3.8).

`SPEC-KERNEL-01`: imports only `zod`. tsconfig `"lib": ["ES2023", "DOM"]` for **types only** (`Blob`, `AbortSignal` in port signatures); runtime purity is enforced by the `SPEC-ARCH-06` (e) grep (no `window`, `document`, `self.`, `fetch(`). No React, no Firebase. Vocabulary = PRD §1 and §8 (PRD-D-19).

## 4.1.1 Vocabulary (`SPEC-KERNEL-02`, PRD-D-19, PRD-D-25)

```ts
export type ViewportId = 'desktop' | 'mobile' | 'tablet' /*[P1]*/;
export const VIEWPORT_PRESETS = { desktop: 1440, mobile: 390, tablet: 768 } as const;
export const VIEWPORT_PREFIX = { desktop: 'D', mobile: 'M', tablet: 'T' } as const;          // Inferred ids I-D-01, I-M-01
export type Engine = 'on-device' | 'cloud' | 'measured';
export type Origin = 'ai' | 'user' | 'sample' | 'precomputed' | 'rule';                       // 'rule' = deterministic generic item
export type Category = 'presence' | 'content' | 'position' | 'size' | 'spacing' | 'typography' | 'colour' | 'responsive';
export type Label = 'explicit' | 'inferred';
export type CheckType = 'measured' | 'visual' | 'judged';
export type Status = 'pass' | 'fail' | 'needs-review' | 'not-checked';
export type NotCheckedReason = 'no-capture' | 'no-dom-snapshot' | 'offline' | 'consent-declined' | 'device-unavailable'
  | 'region-unresolved' | 'misaligned' | 'outside-capture' | 'ai-invalid-output' | 'ai-failed' | 'cloud-disabled' | 'mode-on-device-only' | 'no-inferred-items';
export type Severity = 'critical' | 'major' | 'minor';
export type Confidence = 'high' | 'medium' | 'low';
export type Change = 'resolved' | 'remaining' | 'new' | 'regressed' | 'still-passing';
export type SourceTag = 'dom-snapshot' | 'design-image' | 'capture-image' | 'contract';   // 'contract' = user-accepted value (S7)
// PRD-P-02 'engine' = 'dom-snapshot' | 'capture-image'; 'design image' = 'design-image'; 'contract' = 'contract'
```

## 4.1.2 Domain types

```ts
export interface Rect { x: number; y: number; w: number; h: number }            // CSS px, page coords, top-left origin
export interface Oklab { L: number; a: number; b: number }
export interface ImageRef { blobId: string; mime: 'image/png'; width: number; height: number; cssWidth: number; bytes: number }
export interface DesignRef { id: string; viewport: ViewportId; image: ImageRef; addedAt: number }
export interface Capture { id: string; viewport: ViewportId; image: ImageRef; dom?: DomSnapshot /*§4.5.2*/; addedAt: number;
  warnings: ('width-mismatch' | 'dom-viewport-mismatch')[] }
export interface Project { id: string; name: string; createdAt: number; updatedAt: number; isSample: boolean;
  designs: DesignRef[]; captures: Capture[] /*≤1 per viewport*/; activeContractId?: string; pendingAiContractId?: string /*sample, SPEC-DEMO-03*/;
  cloudConsent?: { grantedAt: number }; cloudUsage: { requests: number; bytes: number } }
export interface ElementMatcher { selector?: string; tag?: string; role?: string; text?: string; within?: ElementMatcher; nth?: number }
export type CheckSpec =                                                      // handlers: SPEC-RUN-03
  | { kind: 'presence'; match: ElementMatcher }
  | { kind: 'count'; match: ElementMatcher; expected: number }               // source 'contract'
  | { kind: 'text'; match: ElementMatcher; expected: string }                // source 'contract'
  | { kind: 'size'; match: ElementMatcher; dimension: 'width' | 'height' }   // design value from snapped region
  | { kind: 'position'; match: ElementMatcher; axis: 'x' | 'y' | 'center-x' }   // P0: checkType 'judged' only (S21)
  | { kind: 'spacing'; a: ElementMatcher; b: ElementMatcher; axis: 'x' | 'y'; aRect?: Rect; bRect?: Rect }  // gap a→b
  | { kind: 'dominant-text'; match: ElementMatcher }
  | { kind: 'colour'; match: ElementMatcher; property: 'background' | 'text' }  // measured needs DOM; else judged (S21)
  | { kind: 'layout-fits' }                                                  // no h-overflow, no overlap, no clipped text
  | { kind: 'visible'; match: ElementMatcher }                               // inferred "primary action stays visible"
  | { kind: 'region-diff' }
  | { kind: 'judged'; question: string };
export interface Requirement { id: string /*'R-01' explicit; 'I-D-01'/'I-M-01' inferred; unique per Contract*/; viewport: ViewportId;
  category: Category; label: Label; checkType: CheckType /*selects the handler path, SPEC-RUN-03*/; statement: string /*≤160*/;
  condition: string /*≤200*/; check: CheckSpec; region?: { rect: Rect; source: 'snapped' | 'user' | 'sample' } | { unresolved: true; suggested: Rect };
  primary?: boolean; accepted: boolean /*PRD-F-03.3*/; origin: Origin; engine?: Engine /*when origin==='ai'*/; derivedFrom?: string }
export interface ManualRequirementDraft { viewport: ViewportId; category: Category; statement: string; condition: string;
  checkType: CheckType; check: CheckSpec /*form offers presence | count | text | dominant-text | layout-fits | judged*/ }
export interface Contract { id: string; projectId: string; version: number; createdAt: number; locked: boolean;
  requirements: Requirement[]; extraction?: TraceStep[] }
export interface Measurement { name: string; design?: number; observed?: number; unit: 'px' | '%' | 'count' | 'deltaE';
  delta?: number; deltaPct?: number; source: { design?: SourceTag; observed: SourceTag } }
export interface Evidence { designCrop?: Rect; captureCrop?: Rect; diffRatio?: number; measurements: Measurement[]; selector?: string }
export interface RequirementResult { requirementId: string; viewport: ViewportId; status: Status; reason?: NotCheckedReason;
  hint?: string /*e.g. 'Re-open contract'*/; engine: Engine; confidence: Confidence; finding?: Finding; origin?: Origin }
export interface Finding { id: string /*`${runId}:${requirementId}:${viewport}`*/; requirementId: string; viewport: ViewportId;
  label: Label; status: 'fail' | 'needs-review'; severity: Severity; confidence: Confidence; engine: Engine;
  statement: string; suggestedFix: string; condition: string; evidence: Evidence; refinedBy?: { engine: 'cloud'; at: number }; origin: Origin }
export interface TraceStep { step: string; engine: Engine; durationMs: number; bytesSent: number;
  requestedMode?: AiMode; promptVersion?: string; model?: string; note?: string }
export interface Run { id: string; projectId: string; contractId: string; createdAt: number; captureIds: string[];
  thresholds: Thresholds; results: RequirementResult[]; trace: TraceStep[]; baselineRunId?: string;
  changes?: Record<string /*reqId:viewport*/, Change>; precomputed: boolean }
export interface Settings { mode: 'auto' | 'cloud-only' | 'on-device-only' /*[P1]*/; onboarded: boolean;
  deepUsage: { day: string /*YYYY-MM-DD local*/; count: number }; everSentToCloud: boolean }
export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;               // §4.3.4
export type DeepOutput = z.infer<typeof DeepOutputSchema>;
export interface PrecomputedJudged { flawed: Record<string /*reqId:viewport*/, JudgeOutput>; fixed: Record<string, JudgeOutput>;
  deep: DeepOutput; extraction: Requirement[] }                               // sample fallback, §4.11
```

`SPEC-KERNEL-03`: zod schemas for every type above, `DomSnapshotV1` (§4.5), `ContractExportV1`/`ReportExportV1` (§4.10) and the AI task outputs (§4.3.4) live in `kernel/schemas.ts`: the single source for model-output validation, storage reads, snapshot paste and import.

## 4.1.3 Ports (implemented in `platform/*` or `features/measure`, injected by `app`)

```ts
export type AiMode = 'ONLY_ON_DEVICE' | 'PREFER_ON_DEVICE' | 'ONLY_IN_CLOUD';             // PREFER_IN_CLOUD unused (S4)
export type AiTask = 'extract-contract' | 'infer-responsive' | 'judge' | 'deep-analysis';
export interface AiImage { mime: 'image/jpeg' | 'image/png'; base64: string; bytes: number; role: 'design' | 'capture' | 'pair' }
export interface AiRequest { task: AiTask; mode: AiMode; system: string; user: string; images: AiImage[];
  promptVersion: string; allowedNumbers: number[] /*SPEC-KERNEL-08*/; consent?: ConsentToken }
export interface AiResponse { json: unknown; engine: 'on-device' | 'cloud' /*from inferenceSource*/; model: string;
  durationMs: number; bytesSent: number /*0 when on-device*/; requestedMode: AiMode }
export interface EngineStatus { device: 'available' | 'downloadable' | 'downloading' | 'unavailable'; deviceImage: boolean | 'unknown';
  reason?: 'no-prompt-api' | 'not-desktop-chrome' | 'chrome-too-old' | 'image-flag-off' | 'hardware' | 'unknown';
  downloadProgress?: number; online: boolean; cloud: 'enabled' | 'disabled' }
export interface AiEngine { status(): Promise<EngineStatus>; downloadDeviceModel(onProgress: (p01: number) => void): Promise<EngineStatus>;
  run(req: AiRequest, signal?: AbortSignal): Promise<AiResponse> }                 // throws CuiError
export interface RuntimeConfig { get(): RuntimeValues; refresh(): Promise<void> }  // §4.1.6
export interface RgbaImage { width: number; height: number; data: Uint8ClampedArray }
export interface ImageCodec {
  normalise(file: Blob, cssWidth: number): Promise<{ blob: Blob; ref: Omit<ImageRef, 'blobId'> }>;
  pixels(blob: Blob): Promise<RgbaImage>;
  crop(blob: Blob, r: Rect, maxSide: number, mime: 'image/jpeg' | 'image/png', opts?: { letterbox?: boolean }): Promise<AiImage & { blob: Blob; letterbox?: Letterbox }>;
  composePair(design: Blob, dr: Rect, capture: Blob, cr: Rect, maxSide: number, opts?: { letterbox?: boolean }): Promise<AiImage & { layout?: PairLayout }>;   // design left, capture right (stacked when letterboxed and wider than 2:1)
  probe(file: Blob): Promise<{ width: number; height: number; mime: string }> }   // source size, no resample (SPEC-MEAS-04)
export interface ImageMeta { width: number; height: number; cssWidth: number }
export interface Alignment { ok: boolean; widthDeltaPct: number; heightDesign: number; heightCapture: number; issues: ('width-mismatch' | 'height-differs')[] }
export interface MeasureApi {   // pure; implemented by features/measure as `measureApi` (§4.4)
  align(design: ImageMeta, capture: ImageMeta & { dom?: DomSnapshot }, t: Thresholds): Alignment;
  snapRegion(img: RgbaImage, suggested: Rect, t: Thresholds): { rect: Rect; iou: number } | { unresolved: true };
  locateOnCapture(design: RgbaImage, dr: Rect, capture: RgbaImage, t: Thresholds): { rect: Rect; score: number };
  regionDiff(design: RgbaImage, dr: Rect, capture: RgbaImage, cr: Rect, t: Thresholds): { diffRatio: number; diffMask: Uint8ClampedArray };
  inkRatio(img: RgbaImage, r: Rect): number;
  dominantColour(img: RgbaImage, r: Rect, property: 'background' | 'text'): Oklab;
  deltaE(a: Oklab, b: Oklab): number;
  matchElements(dom: DomSnapshot, m: ElementMatcher, region?: Rect): DomElement[];
  overflowFacts(dom: DomSnapshot): { horizontalPx: number; beyondViewport: DomElement[]; clipped: DomElement[] };
  overlaps(dom: DomSnapshot): [DomElement, DomElement, Rect][];
  pct(design: number, observed: number): number }                          // signed %, 1 decimal
export type MeasureClient = { [K in keyof MeasureApi]: (...a: Parameters<MeasureApi[K]>) => Promise<ReturnType<MeasureApi[K]>> };
export interface ProjectStore { put(p: Project): Promise<void>; get(id: string): Promise<Project | undefined>; list(): Promise<Project[]>;
  remove(id: string): Promise<void> /*cascade*/; putContract(c: Contract): Promise<void>; getContract(id: string): Promise<Contract | undefined>;
  putRun(r: Run): Promise<void>; getRun(id: string): Promise<Run | undefined>; listRuns(projectId: string): Promise<Run[]>; clearAll(): Promise<void> }
export interface BlobStore { put(blob: Blob): Promise<string>; get(id: string): Promise<Blob | undefined>; remove(id: string): Promise<void> }
export interface SettingsStore { read(): Promise<Settings>; write(s: Partial<Settings>): Promise<void> }
export interface Clock { now(): number }  export interface Ids { next(): string }
export interface SendList { images: { label: string; bytes: number }[]; text: string[] }   // consent sheet (PRD-H-05); used by contract, run, settings
export interface RunSummary { id: string; createdAt: number; contractVersion: number; viewports: ViewportId[]; pass: number; fail: number; review: number }
```

`MeasureApi` member types (`Alignment`, `DomElement`, …) are kernel types; `features/measure` exports `measureApi: MeasureApi` and `inlineMeasureClient(): MeasureClient` (async wrapper, used by `app` in release 1, S22).

## 4.1.4 Consent and mode resolution (PRD-P-05, PRD-H-04, PRD-H-05, PRD-D-16, PRD-D-18)

```ts
export type ConsentToken = { readonly __brand: 'consent'; scope: 'project'; projectId: string }
                         | { readonly __brand: 'consent'; scope: 'deep'; runId: string };
export function mintConsent(scope: { scope: 'project'; projectId: string } | { scope: 'deep'; runId: string },
  ev: { isTrusted: boolean }): ConsentToken;                                   // throws CONSENT_REQUIRED unless ev.isTrusted
export type ModePlan = { kind: 'call'; mode: AiMode; consent?: ConsentToken }
  | { kind: 'needs-consent'; why: 'device-unavailable' | 'device-downloading' | 'device-no-image' | 'cloud-only-mode' }
  | { kind: 'blocked'; reason: NotCheckedReason };
export function resolveMode(i: { setting: Settings['mode']; purpose: 'first-pass' | 'deep'; needsImage: boolean;
  status: EngineStatus; projectConsent?: ConsentToken; deepConsent?: ConsentToken }): ModePlan;
```

| ID | Rule (`resolveMode`, pure, table-tested) |
|---|---|
| `SPEC-KERNEL-04` | `deep` → `ONLY_IN_CLOUD` with `deepConsent`; without it → `needs-consent cloud-only-mode`. Offline → `blocked offline` (checked first, with or without consent); `cloud:'disabled'` → `blocked cloud-disabled`; [P1] setting `on-device-only` (checked after offline) → `blocked mode-on-device-only` (S32). A token of the wrong scope counts as no consent. |
| `SPEC-KERNEL-05` | `auto` + no project consent: device `available` and (`!needsImage` or `deviceImage===true`) → `ONLY_ON_DEVICE`; device available, `needsImage`, no image support → `needs-consent device-no-image`; `downloading` → `needs-consent device-downloading` (UI offers wait or cloud, PRD-H-06); `downloadable`/`unavailable` → `needs-consent device-unavailable`. Never `PREFER_*`. Table rows include: available + `deviceImage:false` + `needsImage:false` → `ONLY_ON_DEVICE` (text-only judge, §4.8.2). |
| `SPEC-KERNEL-06` | `auto` + project consent → `PREFER_ON_DEVICE` (offline and device not usable → `blocked offline`; `cloud:'disabled'` → `ONLY_ON_DEVICE` when the device is usable, else `blocked cloud-disabled`, since `SPEC-AI-09` rejects any cloud-capable call). `cloud-only` → `ONLY_IN_CLOUD`, needs project consent else `needs-consent cloud-only-mode`; offline → `blocked offline`, `cloud:'disabled'` → `blocked cloud-disabled` (both before the consent check). [P1] `on-device-only` → `ONLY_ON_DEVICE` or `blocked device-unavailable`, never cloud. |

## 4.1.5 Pure helpers, limits, errors

| ID | Rule |
|---|---|
| `SPEC-KERNEL-07` | Limits: `ACCEPTED_INPUT_MIME` png/jpeg/webp; `MAX_INPUT_BYTES` 20 MiB; `MAX_SOURCE_SIDE` 8192 px; `MAX_CSS_HEIGHT` 16 000 px; `MAX_SNAPSHOT_BYTES` 1 MiB; `MAX_SNAPSHOT_ELEMENTS` 1500; `MAX_REQUIREMENTS` 60; `MAX_PROJECTS` 50 (notice only). Stated in the UI (PRD-F-02.2). |
| `SPEC-KERNEL-08` | `guardNumbers(text, allowed)`: every number token in model text must equal (±0.5) a value in `allowed`, else the field falls back to the deterministic template and `numberGuardTripped` is recorded (PRD-P-02, PRD-H-02, PRD-M-03). Tokenisation, in order: U+2212 → `-`; requirement ids (`/\b(?:R|I-[A-Z])-\d+\b/g`) are removed; tokens are `/(?:(?<![\w.])(-))?([1-9]\d{0,2}(?:,\d{3})+(?:\.\d+)?(?!\d)|\d+(?:[.,]\d+)?)/g`. The `-` is a sign only when not preceded by a word character or `.` (`10-20` is 10 and 20, `2-column` is 2). `\d{1,3}(,\d{3})+` with a first group not 0 is a thousands separator (`1,440` = 1440, so `3,500` is 3500, never 3.5); any other comma between digits is a decimal point (`0,250` = 0.25, `3,5` = 3.5). |
| `SPEC-KERNEL-10` | `iou(a: Rect, b: Rect): number` (0 when either area is 0). Used by contract dedupe (`SPEC-CON-01`) and the sample comparison (`SPEC-DEMO-03`). |
| `SPEC-KERNEL-11` | `lockContract(c: Contract): Contract` returns `{ ...c, locked: true }`; `nextContractVersion(c, ids, clock)` returns an unlocked copy with `version + 1`, new id, same Requirement ids (`SPEC-CON-06`). |
| `SPEC-KERNEL-12` | `suggestViewport(sourceWidth: number): ViewportId`: rule of `SPEC-MEAS-04`; pure, table-tested. |

`class CuiError extends Error { code: ErrorCode; retryable: boolean }`. No raw SDK error reaches the UI (`SPEC-KERNEL-09`). Codes → copy in §5.4:

| Code | Meaning | Retryable |
|---|---|---|
| `IMAGE_UNSUPPORTED` / `IMAGE_TOO_LARGE` / `IMAGE_DECODE_FAILED` | input format, size, decode | no |
| `SNAPSHOT_INVALID` / `SNAPSHOT_TOO_LARGE` | DOM snapshot paste | no |
| `DEVICE_UNAVAILABLE` / `DEVICE_DOWNLOADING` / `DEVICE_NO_IMAGE` | on-device not usable | no / yes / no |
| `OFFLINE` / `CLOUD_DISABLED` | network / RC kill switch | yes / no |
| `QUOTA_EXCEEDED` / `DAILY_CAP` | HTTP 429 / Deep Analysis cap | yes |
| `APPCHECK_FAILED` | HTTP 401/403 | yes |
| `AI_NOT_ENABLED` | cloud mode + `api-not-enabled` (copy: "Enable Firebase AI Logic in the console") | no |
| `AI_BAD_OUTPUT` | zod failed after 1 retry | yes |
| `AI_BLOCKED` / `AI_FAILED` | safety block / other SDK or network failure | no / yes |
| `AI_TIMEOUT` | the request outlived its timeout (`SPEC-AI-08`); a failure of its own so screens can say "took too long" | yes |
| `CONSENT_REQUIRED` | cloud-capable mode without matching token (defect guard) | no |
| `CONTRACT_LOCKED` / `STORAGE_FAILED` | edit of locked Contract / IndexedDB | no / yes |
| `STORAGE_UNAVAILABLE` | IndexedDB cannot be opened at start (`openStorage`, `SPEC-STORE-04`) | yes (Reload) |

## 4.1.6 Runtime values (`kernel/runtime-values.ts`, PRD-H-07)

`RuntimeValuesSchema` (zod, with clamps), `type RuntimeValues`, `type Thresholds` (threshold keys only, snapshotted into each Run, PRD-P-10, S14) and `DEFAULT_RUNTIME_VALUES` live here. `@fb` only implements the `RuntimeConfig` port from them (`SPEC-FB-07`); E2E uses the static defaults (`SPEC-APP-01`).

| Key | Type | Default | Clamp | Meaning |
|---|---|---|---|---|
| `cloud_first_pass_model` | string | `gemini-3.5-flash-lite` | — | Cloud model for first-pass tasks after consent (SDK default since 13.0.0, set explicitly) |
| `deep_model` | string | `gemini-3.8-flash` | — | Deep Analysis model (VERIFY A4) |
| `prompt_version` | string | `1` | — | Selects `prompts/<task>.v<N>.md`; unknown → `1` |
| `cloud_enabled` | boolean | `true` | — | Kill switch → `CLOUD_DISABLED` (PRD-R-07) |
| `deep_daily_cap` | number | `10` | 0–100 | Per-device Deep Analysis cap (PRD-D-27) |
| `on_device_timeout_s` | number | `180` | 30–600 | Seconds to wait for one on-device model call before `AI_TIMEOUT` (`SPEC-AI-08`); measured 46 s for one band on a Medium-class device |
| `feature_ai_infer_responsive` | boolean | `false` | — | AI-proposed Inferred requirements (§4.7.4) (enable once the `infer-responsive` prompt ships; rule-based Inferred items always run, SPEC-CON-04) |
| `size_tolerance_pct` | number | `8` | 2–30 | Size pass band |
| `major_deviation_pct` | number | `25` | 10–80 | ≥ this → Major |
| `spacing_tolerance_pct` | number | `15` | 5–50 | Spacing pass band |
| `pixel_threshold` | number | `0.1` | 0.01–0.5 | pixelmatch `threshold` |
| `visual_diff_ratio` | number | `0.2` | 0.02–0.8 | Region-diff fail ratio |
| `presence_ink_ratio` | number | `0.03` | 0.005–0.2 | Min non-background share for "present" |
| `colour_delta_e` | number | `0.08` | 0.02–0.3 | OKLab ΔE fail threshold (DOM colour) |
| `snap_min_iou` | number | `0.3` | 0.1–0.9 | Min IoU for a snapped region |
| `search_window_px` | number | `160` | 0–600 | Vertical search for region location on capture |
| `width_mismatch_pct` | number | `2` | 0.5–10 | Capture vs viewport width tolerance |
