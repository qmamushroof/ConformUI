import type { z } from 'zod';
import type { DeepOutputSchema, JudgeOutputSchema } from './ai-outputs';
import type { Thresholds } from './runtime-values';

// SPEC §4.1.1 vocabulary

export type ViewportId = 'desktop' | 'mobile' | 'tablet' /*[P1]*/;
export const VIEWPORT_PRESETS = { desktop: 1440, mobile: 390, tablet: 768 } as const;
export const VIEWPORT_PREFIX = { desktop: 'D', mobile: 'M', tablet: 'T' } as const; // Inferred ids I-D-01, I-M-01
export type Engine = 'on-device' | 'cloud' | 'measured';
export type Origin = 'ai' | 'user' | 'sample' | 'precomputed' | 'rule'; // 'rule' = deterministic generic item
export type Category =
  | 'presence'
  | 'content'
  | 'position'
  | 'size'
  | 'spacing'
  | 'typography'
  | 'colour'
  | 'responsive';
export type Label = 'explicit' | 'inferred';
export type CheckType = 'measured' | 'visual' | 'judged';
export type Status = 'pass' | 'fail' | 'needs-review' | 'not-checked';
export type NotCheckedReason =
  | 'no-capture'
  | 'no-dom-snapshot'
  | 'offline'
  | 'consent-declined'
  | 'device-unavailable'
  | 'region-unresolved'
  | 'misaligned'
  | 'outside-capture'
  | 'ai-invalid-output'
  | 'ai-failed'
  | 'cloud-disabled'
  | 'no-inferred-items';
export type Severity = 'critical' | 'major' | 'minor';
export type Confidence = 'high' | 'medium' | 'low';
export type Change = 'resolved' | 'remaining' | 'new' | 'regressed' | 'still-passing';
export type SourceTag = 'dom-snapshot' | 'design-image' | 'capture-image' | 'contract'; // 'contract' = user-accepted value (S7)
// PRD-P-02 'engine' = 'dom-snapshot' | 'capture-image'; 'design image' = 'design-image'; 'contract' = 'contract'

// AiMode and ConsentToken (SPEC §4.1.3, §4.1.4) live here so every kernel file can import them without a cycle.
export type AiMode = 'ONLY_ON_DEVICE' | 'PREFER_ON_DEVICE' | 'ONLY_IN_CLOUD'; // PREFER_IN_CLOUD unused (S4)
export type ConsentToken =
  | { readonly __brand: 'consent'; scope: 'project'; projectId: string }
  | { readonly __brand: 'consent'; scope: 'deep'; runId: string };

// SPEC §4.1.2 domain types

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
} // CSS px, page coords, top-left origin
export interface Oklab {
  L: number;
  a: number;
  b: number;
}
export interface ImageRef {
  blobId: string;
  mime: 'image/png';
  width: number;
  height: number;
  cssWidth: number;
  bytes: number;
}
export interface DesignRef {
  id: string;
  viewport: ViewportId;
  image: ImageRef;
  addedAt: number;
}
export interface Capture {
  id: string;
  viewport: ViewportId;
  image: ImageRef;
  dom?: DomSnapshot /*§4.5.2*/;
  addedAt: number;
  warnings: ('width-mismatch' | 'dom-viewport-mismatch')[];
}
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isSample: boolean;
  designs: DesignRef[];
  captures: Capture[] /*≤1 per viewport*/;
  activeContractId?: string;
  pendingAiContractId?: string /*sample, SPEC-DEMO-03*/;
  cloudConsent?: { grantedAt: number };
  cloudUsage: { requests: number; bytes: number };
}
export interface ElementMatcher {
  selector?: string;
  tag?: string;
  role?: string;
  text?: string;
  within?: ElementMatcher;
  nth?: number;
}
export type CheckSpec =
  // handlers: SPEC-RUN-03
  | { kind: 'presence'; match: ElementMatcher }
  | { kind: 'count'; match: ElementMatcher; expected: number } // source 'contract'
  | { kind: 'text'; match: ElementMatcher; expected: string } // source 'contract'
  | { kind: 'size'; match: ElementMatcher; dimension: 'width' | 'height' } // design value from snapped region
  | { kind: 'position'; match: ElementMatcher; axis: 'x' | 'y' | 'center-x' } // P0: checkType 'judged' only (S21)
  | { kind: 'spacing'; a: ElementMatcher; b: ElementMatcher; axis: 'x' | 'y'; aRect?: Rect; bRect?: Rect } // gap a→b
  | { kind: 'dominant-text'; match: ElementMatcher }
  | { kind: 'colour'; match: ElementMatcher; property: 'background' | 'text' } // measured needs DOM; else judged (S21)
  | { kind: 'layout-fits' } // no h-overflow, no overlap, no clipped text
  | { kind: 'visible'; match: ElementMatcher } // inferred "primary action stays visible"
  | { kind: 'region-diff' }
  | { kind: 'judged'; question: string };
export interface Requirement {
  id: string /*'R-01' explicit; 'I-D-01'/'I-M-01' inferred; unique per Contract*/;
  viewport: ViewportId;
  category: Category;
  label: Label;
  checkType: CheckType /*selects the handler path, SPEC-RUN-03*/;
  statement: string /*≤160*/;
  condition: string /*≤200*/;
  check: CheckSpec;
  region?: { rect: Rect; source: 'snapped' | 'user' | 'sample' } | { unresolved: true; suggested: Rect };
  primary?: boolean;
  accepted: boolean /*PRD-F-03.3*/;
  origin: Origin;
  engine?: Engine /*when origin==='ai'*/;
  derivedFrom?: string;
}
export interface ManualRequirementDraft {
  viewport: ViewportId;
  category: Category;
  statement: string;
  condition: string;
  checkType: CheckType;
  check: CheckSpec /*form offers presence | count | text | dominant-text | layout-fits | judged*/;
}
export interface Contract {
  id: string;
  projectId: string;
  version: number;
  createdAt: number;
  locked: boolean;
  requirements: Requirement[];
  extraction?: TraceStep[];
}
export interface Measurement {
  name: string;
  design?: number;
  observed?: number;
  unit: 'px' | '%' | 'count' | 'deltaE';
  delta?: number;
  deltaPct?: number;
  source: { design?: SourceTag; observed: SourceTag };
}
export interface Evidence {
  designCrop?: Rect;
  captureCrop?: Rect;
  diffRatio?: number;
  measurements: Measurement[];
  selector?: string;
}
export interface RequirementResult {
  requirementId: string;
  viewport: ViewportId;
  status: Status;
  reason?: NotCheckedReason;
  hint?: string /*e.g. 'Re-open contract'*/;
  engine: Engine;
  confidence: Confidence;
  finding?: Finding;
  origin?: Origin;
}
export interface Finding {
  id: string /*`${runId}:${requirementId}:${viewport}`*/;
  requirementId: string;
  viewport: ViewportId;
  label: Label;
  status: 'fail' | 'needs-review';
  severity: Severity;
  confidence: Confidence;
  engine: Engine;
  statement: string;
  suggestedFix: string;
  condition: string;
  evidence: Evidence;
  refinedBy?: { engine: 'cloud'; at: number };
  origin: Origin;
}
export interface TraceStep {
  step: string;
  engine: Engine;
  durationMs: number;
  bytesSent: number;
  requestedMode?: AiMode;
  promptVersion?: string;
  model?: string;
  note?: string;
}
export interface Run {
  id: string;
  projectId: string;
  contractId: string;
  createdAt: number;
  captureIds: string[];
  thresholds: Thresholds;
  results: RequirementResult[];
  trace: TraceStep[];
  baselineRunId?: string;
  changes?: Record<string /*reqId:viewport*/, Change>;
  precomputed: boolean;
}
export interface Settings {
  mode: 'auto' | 'cloud-only' | 'on-device-only' /*[P1]*/;
  onboarded: boolean;
  deepUsage: { day: string /*YYYY-MM-DD local*/; count: number };
  everSentToCloud: boolean;
}
export type JudgeOutput = z.infer<typeof JudgeOutputSchema>; // §4.3.4
export type DeepOutput = z.infer<typeof DeepOutputSchema>;
export interface PrecomputedJudged {
  flawed: Record<string /*reqId:viewport*/, JudgeOutput>;
  fixed: Record<string, JudgeOutput>;
  deep: DeepOutput;
  extraction: Requirement[];
} // sample fallback, §4.11

// SPEC §4.5.2 DOM snapshot v1 (the zod `DomSnapshotV1` joins in schemas.ts, task 3.4)

export interface DomElement {
  i: number;
  parent: number | null /*index of nearest captured ancestor*/;
  kind: 'landmark' | 'heading' | 'link' | 'button' | 'image' | 'control' | 'text';
  tag: string;
  role?: string;
  level?: number /*h1..h6*/;
  name?: string /*accessible name ≤120*/;
  text?: string /*≤200*/;
  selector: string;
  box: Rect /*page coords: getBoundingClientRect + scrollX/Y, 2 decimals*/;
  visible: boolean;
  style: {
    fontSize: number;
    fontWeight: number;
    lineHeight: number | null;
    fontFamily: string /*first family*/;
    color: string;
    backgroundColor: string;
    display: string;
    position: string;
    overflowX: string;
    marginTop: number;
    marginBottom: number;
    paddingTop: number;
    paddingBottom: number;
    gap: number | null;
    borderRadius: number;
    opacity: number;
  };
  flags: { beyondViewport: boolean; clippedByAncestor: boolean; textClipped: boolean };
}
export interface DomSnapshot {
  schema: 'conformui.dom-snapshot';
  version: 1;
  snippetVersion: string;
  page: { url: string /*origin + pathname only*/; title: string /*≤120*/ };
  capturedAt: string /*ISO*/;
  viewport: { width: number; height: number };
  dpr: number;
  document: { scrollWidth: number; scrollHeight: number; clientWidth: number };
  overflow: { horizontal: boolean; horizontalPx: number };
  elements: DomElement[];
  truncated: boolean;
}
