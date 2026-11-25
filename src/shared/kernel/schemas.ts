import { z } from 'zod';
import { DeepOutputSchema, JudgeOutputSchema } from './ai-outputs';
import {
  AiModeSchema,
  type AiTaskSchema,
  CategorySchema,
  ChangeSchema,
  CheckTypeSchema,
  ConfidenceSchema,
  EngineSchema,
  LabelSchema,
  NotCheckedReasonSchema,
  OriginSchema,
  SeveritySchema,
  SourceTagSchema,
  StatusSchema,
  ViewportIdSchema,
} from './enums';
import { MAX_SNAPSHOT_ELEMENTS } from './limits';
import type { AiTask } from './ports';
import { ThresholdsSchema } from './runtime-values';
import type {
  AiMode,
  Capture,
  Category,
  Change,
  CheckSpec,
  CheckType,
  Confidence,
  Contract,
  DesignRef,
  DomElement,
  DomSnapshot,
  ElementMatcher,
  Engine,
  Evidence,
  Finding,
  ImageRef,
  Label,
  ManualRequirementDraft,
  Measurement,
  NotCheckedReason,
  Oklab,
  Origin,
  PrecomputedJudged,
  Project,
  Rect,
  Requirement,
  RequirementResult,
  Run,
  Settings,
  Severity,
  SourceTag,
  Status,
  TraceStep,
  ViewportId,
} from './types';

// SPEC-KERNEL-03: zod schemas for every kernel data type, DomSnapshotV1 (SPEC-SNIP-01), ContractExportV1 and
// ReportExportV1 (SPEC-EXP-02, SPEC-EXP-03) and the AI task outputs (SPEC §4.3.4). The single source for model-output
// validation, storage reads, snapshot paste and import. Each schema is checked against its interface with `satisfies`.

export * from './ai-outputs';
export * from './enums';

// Vocabulary: each zod enum must equal its TypeScript union in both directions (compile-time only).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export type VocabularyChecks = [
  Same<z.infer<typeof ViewportIdSchema>, ViewportId>,
  Same<z.infer<typeof EngineSchema>, Engine>,
  Same<z.infer<typeof OriginSchema>, Origin>,
  Same<z.infer<typeof CategorySchema>, Category>,
  Same<z.infer<typeof LabelSchema>, Label>,
  Same<z.infer<typeof CheckTypeSchema>, CheckType>,
  Same<z.infer<typeof StatusSchema>, Status>,
  Same<z.infer<typeof NotCheckedReasonSchema>, NotCheckedReason>,
  Same<z.infer<typeof SeveritySchema>, Severity>,
  Same<z.infer<typeof ConfidenceSchema>, Confidence>,
  Same<z.infer<typeof ChangeSchema>, Change>,
  Same<z.infer<typeof SourceTagSchema>, SourceTag>,
  Same<z.infer<typeof AiModeSchema>, AiMode>,
  Same<z.infer<typeof AiTaskSchema>, AiTask>,
];

// Geometry and images

export const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
}) satisfies z.ZodType<Rect>;
export const OklabSchema = z.object({ L: z.number(), a: z.number(), b: z.number() }) satisfies z.ZodType<Oklab>;
export const ImageRefSchema = z.object({
  blobId: z.string(),
  mime: z.literal('image/png'),
  width: z.number().positive(),
  height: z.number().positive(),
  cssWidth: z.number().positive(),
  bytes: z.number().min(0),
}) satisfies z.ZodType<ImageRef>;
export const DesignRefSchema = z.object({
  id: z.string(),
  viewport: ViewportIdSchema,
  image: ImageRefSchema,
  addedAt: z.number(),
}) satisfies z.ZodType<DesignRef>;

// DOM snapshot v1 (SPEC-SNIP-01)

export const DomElementSchema = z.object({
  i: z.number().int().min(0),
  parent: z.number().int().min(0).nullable(),
  kind: z.enum(['landmark', 'heading', 'link', 'button', 'image', 'control', 'text']),
  tag: z.string(),
  role: z.string().optional(),
  level: z.number().int().min(1).max(6).optional(),
  name: z.string().max(120).optional(),
  text: z.string().max(200).optional(),
  selector: z.string(),
  box: RectSchema,
  visible: z.boolean(),
  style: z.object({
    fontSize: z.number(),
    fontWeight: z.number(),
    lineHeight: z.number().nullable(),
    fontFamily: z.string(),
    color: z.string(),
    backgroundColor: z.string(),
    display: z.string(),
    position: z.string(),
    overflowX: z.string(),
    marginTop: z.number(),
    marginBottom: z.number(),
    paddingTop: z.number(),
    paddingBottom: z.number(),
    gap: z.number().nullable(),
    borderRadius: z.number(),
    opacity: z.number(),
  }),
  flags: z.object({ beyondViewport: z.boolean(), clippedByAncestor: z.boolean(), textClipped: z.boolean() }),
}) satisfies z.ZodType<DomElement>;

export const DomSnapshotV1Schema = z.object({
  schema: z.literal('conformui.dom-snapshot'),
  version: z.literal(1),
  snippetVersion: z.string(),
  page: z.object({ url: z.string(), title: z.string().max(120) }),
  capturedAt: z.string(),
  viewport: z.object({ width: z.number(), height: z.number() }),
  dpr: z.number().positive(),
  document: z.object({ scrollWidth: z.number(), scrollHeight: z.number(), clientWidth: z.number() }),
  overflow: z.object({ horizontal: z.boolean(), horizontalPx: z.number() }),
  elements: z.array(DomElementSchema).max(MAX_SNAPSHOT_ELEMENTS),
  truncated: z.boolean(),
}) satisfies z.ZodType<DomSnapshot>;

export const CaptureSchema = z.object({
  id: z.string(),
  viewport: ViewportIdSchema,
  image: ImageRefSchema,
  dom: DomSnapshotV1Schema.optional(),
  addedAt: z.number(),
  warnings: z.array(z.enum(['width-mismatch', 'dom-viewport-mismatch'])),
}) satisfies z.ZodType<Capture>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  isSample: z.boolean(),
  designs: z.array(DesignRefSchema),
  captures: z.array(CaptureSchema),
  activeContractId: z.string().optional(),
  pendingAiContractId: z.string().optional(),
  cloudConsent: z.object({ grantedAt: z.number() }).optional(),
  cloudUsage: z.object({ requests: z.number().min(0), bytes: z.number().min(0) }),
}) satisfies z.ZodType<Project>;

// Contract

export const ElementMatcherSchema: z.ZodType<ElementMatcher> = z.lazy(() =>
  z.object({
    selector: z.string().optional(),
    tag: z.string().optional(),
    role: z.string().optional(),
    text: z.string().optional(),
    within: ElementMatcherSchema.optional(),
    nth: z.number().int().min(0).optional(),
  }),
);

export const CheckSpecSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('presence'), match: ElementMatcherSchema }),
  z.object({ kind: z.literal('count'), match: ElementMatcherSchema, expected: z.number() }),
  z.object({ kind: z.literal('text'), match: ElementMatcherSchema, expected: z.string() }),
  z.object({ kind: z.literal('size'), match: ElementMatcherSchema, dimension: z.enum(['width', 'height']) }),
  z.object({ kind: z.literal('position'), match: ElementMatcherSchema, axis: z.enum(['x', 'y', 'center-x']) }),
  z.object({
    kind: z.literal('spacing'),
    a: ElementMatcherSchema,
    b: ElementMatcherSchema,
    axis: z.enum(['x', 'y']),
    aRect: RectSchema.optional(),
    bRect: RectSchema.optional(),
  }),
  z.object({ kind: z.literal('dominant-text'), match: ElementMatcherSchema }),
  z.object({ kind: z.literal('colour'), match: ElementMatcherSchema, property: z.enum(['background', 'text']) }),
  z.object({ kind: z.literal('layout-fits') }),
  z.object({ kind: z.literal('visible'), match: ElementMatcherSchema }),
  z.object({ kind: z.literal('region-diff') }),
  z.object({ kind: z.literal('judged'), question: z.string() }),
]) satisfies z.ZodType<CheckSpec>;

export const RequirementSchema = z.object({
  id: z.string().min(1),
  viewport: ViewportIdSchema,
  category: CategorySchema,
  label: LabelSchema,
  checkType: CheckTypeSchema,
  statement: z.string().max(160),
  condition: z.string().max(200),
  check: CheckSpecSchema,
  region: z
    .union([
      z.object({ rect: RectSchema, source: z.enum(['snapped', 'user', 'sample']) }),
      z.object({ unresolved: z.literal(true), suggested: RectSchema }),
    ])
    .optional(),
  primary: z.boolean().optional(),
  accepted: z.boolean(),
  origin: OriginSchema,
  engine: EngineSchema.optional(),
  derivedFrom: z.string().optional(),
}) satisfies z.ZodType<Requirement>;

export const ManualRequirementDraftSchema = z.object({
  viewport: ViewportIdSchema,
  category: CategorySchema,
  statement: z.string().max(160),
  condition: z.string().max(200),
  checkType: CheckTypeSchema,
  check: CheckSpecSchema,
}) satisfies z.ZodType<ManualRequirementDraft>;

export const TraceStepSchema = z.object({
  step: z.string(),
  engine: EngineSchema,
  durationMs: z.number().min(0),
  bytesSent: z.number().min(0),
  requestedMode: AiModeSchema.optional(),
  promptVersion: z.string().optional(),
  model: z.string().optional(),
  note: z.string().optional(),
}) satisfies z.ZodType<TraceStep>;

export const ContractSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  version: z.number().int().min(1),
  createdAt: z.number(),
  locked: z.boolean(),
  requirements: z.array(RequirementSchema),
  extraction: z.array(TraceStepSchema).optional(),
}) satisfies z.ZodType<Contract>;

// Run, findings and evidence

export const MeasurementSchema = z.object({
  name: z.string(),
  design: z.number().optional(),
  observed: z.number().optional(),
  unit: z.enum(['px', '%', 'count', 'deltaE']),
  delta: z.number().optional(),
  deltaPct: z.number().optional(),
  source: z.object({ design: SourceTagSchema.optional(), observed: SourceTagSchema }),
}) satisfies z.ZodType<Measurement>;

export const EvidenceSchema = z.object({
  designCrop: RectSchema.optional(),
  captureCrop: RectSchema.optional(),
  diffRatio: z.number().optional(),
  measurements: z.array(MeasurementSchema),
  selector: z.string().optional(),
}) satisfies z.ZodType<Evidence>;

export const FindingSchema = z.object({
  id: z.string(),
  requirementId: z.string(),
  viewport: ViewportIdSchema,
  label: LabelSchema,
  status: z.enum(['fail', 'needs-review']),
  severity: SeveritySchema,
  confidence: ConfidenceSchema,
  engine: EngineSchema,
  statement: z.string(),
  suggestedFix: z.string(),
  condition: z.string(),
  evidence: EvidenceSchema,
  refinedBy: z.object({ engine: z.literal('cloud'), at: z.number() }).optional(),
  origin: OriginSchema,
}) satisfies z.ZodType<Finding>;

export const RequirementResultSchema = z.object({
  requirementId: z.string(),
  viewport: ViewportIdSchema,
  status: StatusSchema,
  reason: NotCheckedReasonSchema.optional(),
  hint: z.string().optional(),
  engine: EngineSchema,
  confidence: ConfidenceSchema,
  finding: FindingSchema.optional(),
  origin: OriginSchema.optional(),
}) satisfies z.ZodType<RequirementResult>;

export const RunSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  contractId: z.string(),
  createdAt: z.number(),
  captureIds: z.array(z.string()),
  thresholds: ThresholdsSchema,
  results: z.array(RequirementResultSchema),
  trace: z.array(TraceStepSchema),
  baselineRunId: z.string().optional(),
  changes: z.record(z.string(), ChangeSchema).optional(),
  precomputed: z.boolean(),
}) satisfies z.ZodType<Run>;

export const SettingsSchema = z.object({
  mode: z.enum(['auto', 'cloud-only', 'on-device-only']),
  onboarded: z.boolean(),
  deepUsage: z.object({ day: z.string(), count: z.number().int().min(0) }),
  everSentToCloud: z.boolean(),
}) satisfies z.ZodType<Settings>;

export const PrecomputedJudgedSchema = z.object({
  flawed: z.record(z.string(), JudgeOutputSchema),
  fixed: z.record(z.string(), JudgeOutputSchema),
  deep: DeepOutputSchema,
  extraction: z.array(RequirementSchema),
}) satisfies z.ZodType<PrecomputedJudged>;

// Exports (SPEC-EXP-02, SPEC-EXP-03): no images, no snapshot text; crops are rects only.

const exportedAt = z.iso.datetime();
const appInfo = z.object({ version: z.string() });
const projectInfo = z.object({ name: z.string(), viewports: z.array(ViewportIdSchema) });

/** A Requirement as exported: `engine` is explicit (`null` when absent). */
export const ExportRequirementSchema = RequirementSchema.omit({ engine: true }).extend({
  engine: EngineSchema.nullable(),
});

export const ContractExportV1Schema = z.object({
  schema: z.literal('conformui.contract'),
  version: z.literal(1),
  exportedAt,
  app: appInfo,
  project: projectInfo,
  contract: z.object({
    version: z.number().int().min(1),
    locked: z.boolean(),
    requirements: z.array(ExportRequirementSchema),
  }),
});

export const ReportExportV1Schema = z.object({
  schema: z.literal('conformui.report'),
  version: z.literal(1),
  exportedAt,
  app: appInfo,
  project: projectInfo,
  contract: z.object({ id: z.string(), version: z.number().int().min(1) }),
  run: z.object({
    id: z.string(),
    createdAt: z.number(),
    viewports: z.array(ViewportIdSchema),
    thresholds: ThresholdsSchema,
    summary: z.object({
      pass: z.number().int().min(0),
      fail: z.number().int().min(0),
      review: z.number().int().min(0),
      notChecked: z.number().int().min(0),
    }),
    changes: z.record(z.string(), ChangeSchema).optional(),
    trace: z.array(TraceStepSchema),
    precomputed: z.boolean(),
  }),
  results: z.array(RequirementResultSchema),
});

export type ContractExportV1 = z.infer<typeof ContractExportV1Schema>;
export type ReportExportV1 = z.infer<typeof ReportExportV1Schema>;
