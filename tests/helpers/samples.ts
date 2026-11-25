import {
  type Capture,
  type Contract,
  DEFAULT_RUNTIME_VALUES,
  type DesignRef,
  type DomElement,
  type DomSnapshot,
  type Evidence,
  type Finding,
  type ImageRef,
  type Measurement,
  type PrecomputedJudged,
  type Project,
  type Rect,
  type Requirement,
  type RequirementResult,
  type Run,
  type Settings,
  type Thresholds,
  type TraceStep,
} from '@kernel';

// Valid sample values for every kernel data type. Tests spread and override these instead of rebuilding objects.

export const rect = (over: Partial<Rect> = {}): Rect => ({ x: 0, y: 0, w: 100, h: 50, ...over });

export const imageRef = (over: Partial<ImageRef> = {}): ImageRef => ({
  blobId: 'blob-1',
  mime: 'image/png',
  width: 1440,
  height: 900,
  cssWidth: 1440,
  bytes: 1234,
  ...over,
});

export const designRef = (over: Partial<DesignRef> = {}): DesignRef => ({
  id: 'design-1',
  viewport: 'desktop',
  image: imageRef(),
  addedAt: 1_700_000_000_000,
  ...over,
});

export const domElement = (over: Partial<DomElement> = {}): DomElement => ({
  i: 0,
  parent: null,
  kind: 'button',
  tag: 'button',
  role: 'button',
  name: 'Start free',
  text: 'Start free',
  selector: '#cta',
  box: { x: 10, y: 20, w: 132, h: 40 },
  visible: true,
  style: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 24,
    fontFamily: 'Inter',
    color: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(37, 99, 235)',
    display: 'inline-block',
    position: 'static',
    overflowX: 'visible',
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 8,
    paddingBottom: 8,
    gap: null,
    borderRadius: 6,
    opacity: 1,
  },
  flags: { beyondViewport: false, clippedByAncestor: false, textClipped: false },
  ...over,
});

export const domSnapshot = (over: Partial<DomSnapshot> = {}): DomSnapshot => ({
  schema: 'conformui.dom-snapshot',
  version: 1,
  snippetVersion: '1.0.0',
  page: { url: 'https://example.test/landing', title: 'Sample landing page' },
  capturedAt: '2026-11-25T10:00:00.000Z',
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  document: { scrollWidth: 1440, scrollHeight: 2400, clientWidth: 1440 },
  overflow: { horizontal: false, horizontalPx: 0 },
  elements: [domElement()],
  truncated: false,
  ...over,
});

export const capture = (over: Partial<Capture> = {}): Capture => ({
  id: 'capture-1',
  viewport: 'desktop',
  image: imageRef(),
  dom: domSnapshot(),
  addedAt: 1_700_000_000_000,
  warnings: [],
  ...over,
});

export const project = (over: Partial<Project> = {}): Project => ({
  id: 'project-1',
  name: 'Sample landing page',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  isSample: false,
  designs: [designRef()],
  captures: [capture()],
  cloudUsage: { requests: 0, bytes: 0 },
  ...over,
});

export const requirement = (over: Partial<Requirement> = {}): Requirement => ({
  id: 'R-01',
  viewport: 'desktop',
  category: 'size',
  label: 'explicit',
  checkType: 'measured',
  statement: 'Primary CTA is 220 px wide',
  condition: 'CTA width within 8% of 220 px',
  check: { kind: 'size', match: { tag: 'button', text: 'Start free' }, dimension: 'width' },
  region: { rect: rect(), source: 'snapped' },
  primary: true,
  accepted: true,
  origin: 'ai',
  engine: 'on-device',
  ...over,
});

export const contract = (over: Partial<Contract> = {}): Contract => ({
  id: 'contract-1',
  projectId: 'project-1',
  version: 1,
  createdAt: 1_700_000_000_000,
  locked: false,
  requirements: [requirement()],
  ...over,
});

export const measurement = (over: Partial<Measurement> = {}): Measurement => ({
  name: 'CTA width',
  design: 220,
  observed: 132,
  unit: 'px',
  delta: -88,
  deltaPct: -40,
  source: { design: 'design-image', observed: 'dom-snapshot' },
  ...over,
});

export const evidence = (over: Partial<Evidence> = {}): Evidence => ({
  designCrop: rect(),
  captureCrop: rect({ x: 4 }),
  measurements: [measurement()],
  selector: '#cta',
  ...over,
});

export const finding = (over: Partial<Finding> = {}): Finding => ({
  id: 'run-1:R-01:desktop',
  requirementId: 'R-01',
  viewport: 'desktop',
  label: 'explicit',
  status: 'fail',
  severity: 'major',
  confidence: 'high',
  engine: 'measured',
  statement: 'Primary CTA is 220 px wide',
  suggestedFix: 'Set the CTA width to 220 px',
  condition: 'CTA width within 8% of 220 px',
  evidence: evidence(),
  origin: 'ai',
  ...over,
});

export const requirementResult = (over: Partial<RequirementResult> = {}): RequirementResult => ({
  requirementId: 'R-01',
  viewport: 'desktop',
  status: 'fail',
  engine: 'measured',
  confidence: 'high',
  finding: finding(),
  origin: 'ai',
  ...over,
});

export const traceStep = (over: Partial<TraceStep> = {}): TraceStep => ({
  step: 'extract-contract',
  engine: 'on-device',
  durationMs: 1200,
  bytesSent: 0,
  requestedMode: 'ONLY_ON_DEVICE',
  promptVersion: '1',
  ...over,
});

export const thresholds = (): Thresholds => ({
  size_tolerance_pct: DEFAULT_RUNTIME_VALUES.size_tolerance_pct,
  major_deviation_pct: DEFAULT_RUNTIME_VALUES.major_deviation_pct,
  spacing_tolerance_pct: DEFAULT_RUNTIME_VALUES.spacing_tolerance_pct,
  pixel_threshold: DEFAULT_RUNTIME_VALUES.pixel_threshold,
  visual_diff_ratio: DEFAULT_RUNTIME_VALUES.visual_diff_ratio,
  presence_ink_ratio: DEFAULT_RUNTIME_VALUES.presence_ink_ratio,
  colour_delta_e: DEFAULT_RUNTIME_VALUES.colour_delta_e,
  snap_min_iou: DEFAULT_RUNTIME_VALUES.snap_min_iou,
  search_window_px: DEFAULT_RUNTIME_VALUES.search_window_px,
  width_mismatch_pct: DEFAULT_RUNTIME_VALUES.width_mismatch_pct,
});

export const run = (over: Partial<Run> = {}): Run => ({
  id: 'run-1',
  projectId: 'project-1',
  contractId: 'contract-1',
  createdAt: 1_700_000_000_000,
  captureIds: ['capture-1'],
  thresholds: thresholds(),
  results: [requirementResult()],
  trace: [traceStep()],
  changes: { 'R-01:desktop': 'remaining' },
  precomputed: false,
  ...over,
});

export const settings = (over: Partial<Settings> = {}): Settings => ({
  mode: 'auto',
  onboarded: false,
  deepUsage: { day: '2026-11-25', count: 0 },
  everSentToCloud: false,
  ...over,
});

export const precomputed = (): PrecomputedJudged => ({
  flawed: {
    'R-07:desktop': {
      verdict: 'fail',
      confidence: 'medium',
      explanation: 'Hero image is cropped.',
      suggestedFix: 'Use object-fit: cover.',
    },
  },
  fixed: {
    'R-07:desktop': {
      verdict: 'pass',
      confidence: 'high',
      explanation: 'Hero image fits.',
      suggestedFix: 'None needed.',
    },
  },
  deep: { items: [] },
  extraction: [requirement({ origin: 'precomputed' })],
});
