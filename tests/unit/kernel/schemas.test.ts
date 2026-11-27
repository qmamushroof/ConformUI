import {
  CaptureSchema,
  CheckSpecSchema,
  ContractExportV1Schema,
  ContractSchema,
  DeepOutputSchema,
  DesignRefSchema,
  DomElementSchema,
  DomSnapshotV1Schema,
  ElementMatcherSchema,
  EvidenceSchema,
  ExtractOutputSchema,
  FindingSchema,
  ImageRefSchema,
  InferOutputSchema,
  JudgeOutputSchema,
  MAX_SNAPSHOT_ELEMENTS,
  ManualRequirementDraftSchema,
  MeasurementSchema,
  OklabSchema,
  PrecomputedJudgedSchema,
  ProjectSchema,
  RectSchema,
  ReportExportV1Schema,
  RequirementResultSchema,
  RequirementSchema,
  RunSchema,
  SettingsSchema,
  TraceStepSchema,
} from '@kernel';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import * as s from '../../helpers/samples';

// SPEC-KERNEL-03: zod schemas for every kernel type; one valid and one invalid sample per schema.

interface Case {
  name: string;
  schema: z.ZodType;
  valid: () => unknown;
  invalid: () => unknown;
}

const clone = <T>(v: T): T => structuredClone(v);

const cases: Case[] = [
  { name: 'Rect', schema: RectSchema, valid: () => s.rect(), invalid: () => ({ x: 0, y: 0, w: 'wide', h: 1 }) },
  { name: 'Oklab', schema: OklabSchema, valid: () => ({ L: 0.5, a: 0, b: 0 }), invalid: () => ({ L: 0.5, a: 0 }) },
  {
    name: 'ImageRef',
    schema: ImageRefSchema,
    valid: () => s.imageRef(),
    invalid: () => s.imageRef({ mime: 'image/webp' as 'image/png' }),
  },
  {
    name: 'DesignRef',
    schema: DesignRefSchema,
    valid: () => s.designRef(),
    invalid: () => s.designRef({ viewport: 'watch' as 'desktop' }),
  },
  {
    name: 'DomElement',
    schema: DomElementSchema,
    valid: () => s.domElement(),
    invalid: () => s.domElement({ kind: 'div' as 'text' }),
  },
  {
    name: 'DomSnapshotV1',
    schema: DomSnapshotV1Schema,
    valid: () => s.domSnapshot(),
    invalid: () => s.domSnapshot({ version: 2 as 1 }),
  },
  {
    name: 'Capture',
    schema: CaptureSchema,
    valid: () => s.capture(),
    invalid: () => s.capture({ warnings: ['nope' as 'width-mismatch'] }),
  },
  {
    name: 'Project',
    schema: ProjectSchema,
    valid: () => s.project(),
    invalid: () => ({ ...s.project(), cloudUsage: undefined }),
  },
  {
    name: 'ElementMatcher',
    schema: ElementMatcherSchema,
    valid: () => ({ tag: 'a', within: { role: 'navigation', within: { tag: 'header' } }, nth: 1 }),
    invalid: () => ({ tag: 'a', within: { nth: 'first' } }),
  },
  {
    name: 'CheckSpec',
    schema: CheckSpecSchema,
    valid: () => ({ kind: 'spacing', a: { tag: 'h1' }, b: { tag: 'p' }, axis: 'y', aRect: s.rect() }),
    invalid: () => ({ kind: 'teleport' }),
  },
  {
    name: 'Requirement',
    schema: RequirementSchema,
    valid: () => s.requirement(),
    invalid: () => s.requirement({ statement: 'x'.repeat(161) }),
  },
  {
    name: 'ManualRequirementDraft',
    schema: ManualRequirementDraftSchema,
    valid: () => ({
      viewport: 'mobile',
      category: 'presence',
      statement: 'Logo is visible',
      condition: 'Logo present in header',
      checkType: 'measured',
      check: { kind: 'presence', match: { tag: 'img' } },
    }),
    invalid: () => ({ viewport: 'mobile', category: 'presence' }),
  },
  {
    name: 'Contract',
    schema: ContractSchema,
    valid: () => s.contract(),
    invalid: () => s.contract({ version: 'one' as unknown as number }),
  },
  {
    name: 'Measurement',
    schema: MeasurementSchema,
    valid: () => s.measurement(),
    invalid: () => ({ ...s.measurement(), source: {} }),
  },
  {
    name: 'Evidence',
    schema: EvidenceSchema,
    valid: () => s.evidence(),
    invalid: () => ({ ...s.evidence(), measurements: 'none' }),
  },
  {
    name: 'RequirementResult',
    schema: RequirementResultSchema,
    valid: () => s.requirementResult(),
    invalid: () => s.requirementResult({ status: 'maybe' as 'pass' }),
  },
  {
    name: 'Finding',
    schema: FindingSchema,
    valid: () => s.finding(),
    invalid: () => s.finding({ status: 'pass' as 'fail' }),
  },
  {
    name: 'TraceStep',
    schema: TraceStepSchema,
    valid: () => s.traceStep(),
    invalid: () => s.traceStep({ engine: 'gpu' as 'cloud' }),
  },
  {
    name: 'Run',
    schema: RunSchema,
    valid: () => s.run(),
    invalid: () => ({ ...s.run(), thresholds: { size_tolerance_pct: 8 } }),
  },
  {
    name: 'Settings',
    schema: SettingsSchema,
    valid: () => s.settings(),
    invalid: () => s.settings({ mode: 'turbo' as 'auto' }),
  },
  {
    name: 'PrecomputedJudged',
    schema: PrecomputedJudgedSchema,
    valid: () => s.precomputed(),
    invalid: () => ({ ...s.precomputed(), deep: { items: [{ findingId: 'f' }] } }),
  },
];

describe('SPEC-KERNEL-03: a valid and an invalid sample per schema', () => {
  for (const c of cases) {
    it(`SPEC-KERNEL-03: ${c.name} accepts a valid sample`, () => {
      expect(c.schema.safeParse(c.valid()).success).toBe(true);
    });
    it(`SPEC-KERNEL-03: ${c.name} rejects an invalid sample`, () => {
      expect(c.schema.safeParse(c.invalid()).success).toBe(false);
    });
  }
});

describe('SPEC-KERNEL-03, SPEC-KERNEL-02: field limits and variants', () => {
  it('SPEC-KERNEL-03: Requirement statement is limited to 160 characters and condition to 200', () => {
    expect(RequirementSchema.safeParse(s.requirement({ statement: 'x'.repeat(160) })).success).toBe(true);
    expect(RequirementSchema.safeParse(s.requirement({ statement: 'x'.repeat(161) })).success).toBe(false);
    expect(RequirementSchema.safeParse(s.requirement({ condition: 'x'.repeat(200) })).success).toBe(true);
    expect(RequirementSchema.safeParse(s.requirement({ condition: 'x'.repeat(201) })).success).toBe(false);
  });

  it('SPEC-KERNEL-02: Requirement region accepts the unresolved variant and rejects a half-formed one', () => {
    const unresolved = s.requirement({ region: { unresolved: true, suggested: s.rect() } });
    expect(RequirementSchema.safeParse(unresolved).success).toBe(true);
    const bad = { ...s.requirement(), region: { unresolved: true } };
    expect(RequirementSchema.safeParse(bad).success).toBe(false);
    const badSource = { ...s.requirement(), region: { rect: s.rect(), source: 'guess' } };
    expect(RequirementSchema.safeParse(badSource).success).toBe(false);
  });

  it('SPEC-KERNEL-02: every CheckSpec kind of SPEC §4.1.2 parses', () => {
    const m = { tag: 'button' };
    const specs = [
      { kind: 'presence', match: m },
      { kind: 'count', match: m, expected: 3 },
      { kind: 'text', match: m, expected: 'Start free' },
      { kind: 'size', match: m, dimension: 'height' },
      { kind: 'position', match: m, axis: 'center-x' },
      { kind: 'spacing', a: m, b: m, axis: 'x' },
      { kind: 'dominant-text', match: m },
      { kind: 'colour', match: m, property: 'text' },
      { kind: 'layout-fits' },
      { kind: 'visible', match: m },
      { kind: 'region-diff' },
      { kind: 'judged', question: 'Does the hero match?' },
    ];
    for (const spec of specs) expect(CheckSpecSchema.safeParse(spec).success, spec.kind).toBe(true);
    expect(CheckSpecSchema.safeParse({ kind: 'size', match: m, dimension: 'depth' }).success).toBe(false);
    expect(CheckSpecSchema.safeParse({ kind: 'count', match: m }).success).toBe(false);
  });

  it('SPEC-KERNEL-03: Capture, Project and Run drop nothing and accept optional parts being absent', () => {
    const { dom: _dom, ...noDom } = s.capture();
    expect(CaptureSchema.safeParse(noDom).success).toBe(true);
    expect(ProjectSchema.safeParse(s.project({ cloudConsent: { grantedAt: 5 }, activeContractId: 'c' })).success).toBe(
      true,
    );
    const { changes: _c, ...noChanges } = s.run();
    expect(RunSchema.safeParse(noChanges).success).toBe(true);
  });

  it('SPEC-KERNEL-03: parsing returns the same data (round trip)', () => {
    const r = s.run();
    expect(RunSchema.parse(clone(r))).toEqual(r);
    const p = s.project();
    expect(ProjectSchema.parse(clone(p))).toEqual(p);
  });

  it('SPEC-KERNEL-03: Settings.mode accepts auto, cloud-only and on-device-only', () => {
    for (const mode of ['auto', 'cloud-only', 'on-device-only'] as const) {
      expect(SettingsSchema.safeParse(s.settings({ mode })).success).toBe(true);
    }
  });
});

describe('SPEC-SNIP-01, SPEC-KERNEL-03: DomSnapshotV1', () => {
  it('SPEC-SNIP-01: wrong schema literal or wrong version is rejected', () => {
    expect(DomSnapshotV1Schema.safeParse({ ...s.domSnapshot(), schema: 'other' }).success).toBe(false);
    expect(DomSnapshotV1Schema.safeParse({ ...s.domSnapshot(), version: 2 }).success).toBe(false);
  });

  it('SPEC-SNIP-01, SPEC-KERNEL-07: more than MAX_SNAPSHOT_ELEMENTS elements is rejected', () => {
    const el = s.domElement();
    const ok = Array.from({ length: MAX_SNAPSHOT_ELEMENTS }, (_, i) => ({ ...el, i }));
    expect(DomSnapshotV1Schema.safeParse(s.domSnapshot({ elements: ok })).success).toBe(true);
    expect(DomSnapshotV1Schema.safeParse(s.domSnapshot({ elements: [...ok, { ...el, i: ok.length }] })).success).toBe(
      false,
    );
  });

  it('SPEC-SNIP-01: element limits (name <= 120, text <= 200, title <= 120) and level 1..6', () => {
    expect(DomElementSchema.safeParse(s.domElement({ name: 'n'.repeat(121) })).success).toBe(false);
    expect(DomElementSchema.safeParse(s.domElement({ text: 't'.repeat(201) })).success).toBe(false);
    expect(DomElementSchema.safeParse(s.domElement({ level: 7 })).success).toBe(false);
    expect(DomElementSchema.safeParse(s.domElement({ kind: 'heading', tag: 'h2', level: 2 })).success).toBe(true);
    expect(
      DomSnapshotV1Schema.safeParse(s.domSnapshot({ page: { url: 'https://x.test/', title: 't'.repeat(121) } }))
        .success,
    ).toBe(false);
  });

  it('SPEC-SNIP-01: a null parent and null lineHeight/gap are valid; a missing style key is not', () => {
    const base = s.domElement();
    expect(
      DomElementSchema.safeParse({ ...base, parent: null, style: { ...base.style, lineHeight: null, gap: null } })
        .success,
    ).toBe(true);
    const { opacity: _o, ...rest } = base.style;
    expect(DomElementSchema.safeParse({ ...base, style: rest }).success).toBe(false);
  });
});

describe('SPEC-EXP-02, SPEC-KERNEL-03: ContractExportV1', () => {
  const valid = () => ({
    schema: 'conformui.contract',
    version: 1,
    exportedAt: '2026-11-25T10:00:00.000Z',
    app: { version: 'abc1234' },
    project: { name: 'Sample landing page', viewports: ['desktop', 'mobile'] },
    contract: { version: 1, locked: true, requirements: [{ ...s.requirement(), engine: null }] },
  });

  it('SPEC-EXP-02: a valid export parses; engine is explicit (a value or null, never missing)', () => {
    expect(ContractExportV1Schema.safeParse(valid()).success).toBe(true);
    const { engine: _e, ...noEngine } = s.requirement();
    expect(
      ContractExportV1Schema.safeParse({
        ...valid(),
        contract: { ...valid().contract, requirements: [noEngine] },
      }).success,
    ).toBe(false);
  });

  it('SPEC-EXP-02: wrong schema or version, or a requirement without label/checkType/origin, is rejected', () => {
    expect(ContractExportV1Schema.safeParse({ ...valid(), schema: 'conformui.report' }).success).toBe(false);
    expect(ContractExportV1Schema.safeParse({ ...valid(), version: 2 }).success).toBe(false);
    const { label: _l, ...noLabel } = s.requirement();
    const bad = { ...valid(), contract: { ...valid().contract, requirements: [{ ...noLabel, engine: null }] } };
    expect(ContractExportV1Schema.safeParse(bad).success).toBe(false);
  });

  it('SPEC-EXP-02: exports carry no images or snapshot text (unknown keys are stripped, not kept)', () => {
    const withImage = { ...valid(), images: ['data:image/png;base64,AAAA'], snapshot: { elements: [] } };
    const parsed = ContractExportV1Schema.parse(withImage) as Record<string, unknown>;
    expect(parsed.images).toBeUndefined();
    expect(parsed.snapshot).toBeUndefined();
  });
});

describe('SPEC-EXP-03, SPEC-KERNEL-03: ReportExportV1', () => {
  const valid = () => ({
    schema: 'conformui.report',
    version: 1,
    exportedAt: '2026-11-25T10:00:00.000Z',
    app: { version: 'abc1234' },
    project: { name: 'Sample landing page', viewports: ['desktop'] },
    contract: { id: 'contract-1', version: 1 },
    run: {
      id: 'run-1',
      createdAt: 1_700_000_000_000,
      viewports: ['desktop'],
      thresholds: s.thresholds(),
      summary: { pass: 3, fail: 1, review: 1, notChecked: 0 },
      changes: { 'R-01:desktop': 'remaining' },
      trace: [s.traceStep()],
      precomputed: false,
    },
    results: [s.requirementResult()],
  });

  it('SPEC-EXP-03: a valid report parses', () => {
    expect(ReportExportV1Schema.safeParse(valid()).success).toBe(true);
  });

  it('SPEC-EXP-03, SPEC-EXP-05: a measurement without a source tag is rejected', () => {
    const bad = valid();
    const f = s.finding({
      evidence: s.evidence({ measurements: [{ ...s.measurement(), source: undefined } as never] }),
    });
    bad.results = [s.requirementResult({ finding: f })];
    expect(ReportExportV1Schema.safeParse(bad).success).toBe(false);
  });

  it('SPEC-EXP-03: wrong schema literal, missing run or out-of-range threshold is rejected', () => {
    expect(ReportExportV1Schema.safeParse({ ...valid(), schema: 'conformui.contract' }).success).toBe(false);
    const { run: _r, ...noRun } = valid();
    expect(ReportExportV1Schema.safeParse(noRun).success).toBe(false);
    const bad = valid();
    bad.run.thresholds = { ...s.thresholds(), size_tolerance_pct: 500 };
    expect(ReportExportV1Schema.safeParse(bad).success).toBe(false);
  });
});

describe('SPEC-KERNEL-03, SPEC-AI-05: the four AI task outputs', () => {
  const extractReq = () => ({
    category: 'size',
    statement: 'Primary CTA is 220 px wide',
    condition: 'CTA width within 8%',
    checkKind: 'size',
    box_2d: [200, 100, 260, 300],
    matchHint: { tag: 'button', text: 'Start free' },
    primary: true,
  });

  it('SPEC-KERNEL-03: extract-contract accepts a valid output and rejects a wrong one', () => {
    expect(ExtractOutputSchema.safeParse({ requirements: [extractReq()] }).success).toBe(true);
    expect(ExtractOutputSchema.safeParse({ requirements: [{ ...extractReq(), checkKind: 'vibes' }] }).success).toBe(
      false,
    );
    expect(ExtractOutputSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('SPEC-KERNEL-03: extract-contract allows at most 8 requirements, boxes within 0..1000 with four numbers', () => {
    const eight = Array.from({ length: 8 }, extractReq);
    expect(ExtractOutputSchema.safeParse({ requirements: eight }).success).toBe(true);
    expect(ExtractOutputSchema.safeParse({ requirements: [...eight, extractReq()] }).success).toBe(false);
    expect(
      ExtractOutputSchema.safeParse({ requirements: [{ ...extractReq(), box_2d: [0, 0, 1001, 10] }] }).success,
    ).toBe(false);
    expect(
      ExtractOutputSchema.safeParse({ requirements: [{ ...extractReq(), box_2d: [-1, 0, 10, 10] }] }).success,
    ).toBe(false);
    expect(ExtractOutputSchema.safeParse({ requirements: [{ ...extractReq(), box_2d: [0, 0, 10] }] }).success).toBe(
      false,
    );
  });

  it('SPEC-KERNEL-03: extract-contract optional fields (expectedText, expectedCount, primary, matchHint parts)', () => {
    const r = { ...extractReq(), matchHint: {}, expectedText: 'Hi', expectedCount: 3, primary: undefined };
    expect(ExtractOutputSchema.safeParse({ requirements: [r] }).success).toBe(true);
    expect(ExtractOutputSchema.safeParse({ requirements: [{ ...r, statement: 'x'.repeat(161) }] }).success).toBe(false);
  });

  it('SPEC-KERNEL-03: infer-responsive accepts up to 6 items with its three check kinds', () => {
    const item = {
      fromRequirementId: 'R-01',
      checkKind: 'visible',
      statement: 'CTA stays visible',
      condition: 'CTA inside viewport',
    };
    expect(InferOutputSchema.safeParse({ items: [item] }).success).toBe(true);
    expect(InferOutputSchema.safeParse({ items: Array.from({ length: 6 }, () => item) }).success).toBe(true);
    expect(InferOutputSchema.safeParse({ items: Array.from({ length: 7 }, () => item) }).success).toBe(false);
    expect(InferOutputSchema.safeParse({ items: [{ ...item, checkKind: 'size' }] }).success).toBe(false);
  });

  it('SPEC-KERNEL-03: judge enforces verdict, confidence and the 300/200 character limits', () => {
    const ok = { verdict: 'uncertain', confidence: 'low', explanation: 'x'.repeat(300), suggestedFix: 'y'.repeat(200) };
    expect(JudgeOutputSchema.safeParse(ok).success).toBe(true);
    expect(JudgeOutputSchema.safeParse({ ...ok, explanation: 'x'.repeat(301) }).success).toBe(false);
    expect(JudgeOutputSchema.safeParse({ ...ok, suggestedFix: 'y'.repeat(201) }).success).toBe(false);
    expect(JudgeOutputSchema.safeParse({ ...ok, verdict: 'maybe' }).success).toBe(false);
  });

  it('SPEC-KERNEL-03: deep-analysis accepts items with optional crossViewportCause and rejects a bad status', () => {
    const item = {
      findingId: 'run-1:R-01:desktop',
      status: 'needs-review',
      confidence: 'medium',
      explanation: 'e',
      suggestedFix: 'f',
    };
    expect(DeepOutputSchema.safeParse({ items: [item, { ...item, crossViewportCause: 'Shared nav' }] }).success).toBe(
      true,
    );
    expect(DeepOutputSchema.safeParse({ items: [{ ...item, status: 'meh' }] }).success).toBe(false);
  });
});
