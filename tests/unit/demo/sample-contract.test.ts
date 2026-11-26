import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ContractSchema,
  DeepOutputSchema,
  PrecomputedJudgedSchema,
  type Rect,
  type Requirement,
  RequirementSchema,
} from '@kernel';
import { measureApi } from '@measure';
import { describe, expect, it } from 'vitest';
import { createNodeImageCodec, solidImage } from '../../helpers/node-codec';
import { thresholds } from '../../helpers/samples';

const sampleDir = resolve(__dirname, '../../../src/features/demo/sample');
const json = (p: string): unknown => JSON.parse(readFileSync(join(sampleDir, p), 'utf8'));
const contract = ContractSchema.parse(json('contract.json'));
const byId = (id: string) => contract.requirements.find((r) => r.id === id) as Requirement;

// Rough design-space rectangles a user (or the model) would suggest; snapRegion must land on the committed regions.
const SUGGESTED: Record<string, Rect> = {
  'R-01': { x: 800, y: 136, w: 520, h: 400 },
  'R-02': { x: 120, y: 393, w: 220, h: 52 },
  'R-03': { x: 120, y: 227, w: 632, h: 62 },
  'R-04': { x: 320, y: 25, w: 276, h: 20 },
  'R-05': { x: 130, y: 22, w: 140, h: 28 },
  'R-06': { x: 120, y: 136, w: 1200, h: 534 },
  'R-07': { x: 120, y: 393, w: 220, h: 52 },
  'R-08': { x: 118, y: 1015, w: 404, h: 24 },
};

async function designAtCss() {
  const src = await createNodeImageCodec().pixels(
    new Blob([readFileSync(join(sampleDir, 'design-desktop.png'))], { type: 'image/png' }),
  );
  const out = solidImage(src.width / 2, Math.floor(src.height / 2), [255, 255, 255, 255]);
  const offs = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const;
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      for (let c = 0; c < 4; c++) {
        let s = 0;
        for (const [dx, dy] of offs) s += src.data[((2 * y + dy) * src.width + 2 * x + dx) * 4 + c] ?? 0;
        out.data[(y * out.width + x) * 4 + c] = Math.round(s / 4);
      }
    }
  }
  return out;
}

describe('verified sample Contract (SPEC-DEMO-01)', () => {
  it('SPEC-DEMO-01, SPEC-KERNEL-03: contract.json is a valid kernel Contract with R-01..R-07 and I-M-01, I-M-02', () => {
    const ids = contract.requirements.map((r) => r.id);
    for (const id of ['R-01', 'R-02', 'R-03', 'R-04', 'R-05', 'R-06', 'R-07', 'I-M-01', 'I-M-02']) {
      expect(ids, id).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(contract.version).toBe(1);
  });

  it("SPEC-DEMO-01, SPEC-DEMO-05: every item is origin 'sample' and accepted; Explicit R-*, Inferred I-M-*", () => {
    for (const r of contract.requirements) {
      expect(r.origin, r.id).toBe('sample');
      expect(r.accepted, r.id).toBe(true);
      expect(r.label, r.id).toBe(r.id.startsWith('I-') ? 'inferred' : 'explicit');
      expect(r.statement.length, r.id).toBeLessThanOrEqual(160);
      expect(r.condition.length, r.id).toBeLessThanOrEqual(200);
    }
  });

  it('SPEC-DEMO-01, PRD-M-01: each planted defect maps to its category, check kind and check type', () => {
    const shape = (id: string) => ({ k: byId(id).check.kind, t: byId(id).checkType, c: byId(id).category });
    expect(shape('R-01')).toEqual({ k: 'presence', t: 'visual', c: 'presence' });
    expect(shape('R-02')).toEqual({ k: 'size', t: 'measured', c: 'size' });
    expect(shape('R-03')).toEqual({ k: 'dominant-text', t: 'measured', c: 'typography' });
    expect(shape('R-04')).toEqual({ k: 'count', t: 'measured', c: 'content' });
    expect(shape('R-06')).toEqual({ k: 'spacing', t: 'measured', c: 'spacing' });
    expect(shape('R-07')).toEqual({ k: 'judged', t: 'judged', c: 'colour' });
    expect(shape('I-M-01')).toEqual({ k: 'layout-fits', t: 'measured', c: 'responsive' });
    expect(byId('R-02').check).toMatchObject({ dimension: 'width' });
    expect(byId('R-02').primary).toBe(true);
    expect(byId('R-04').check).toMatchObject({ kind: 'count', expected: 4 });
    expect(byId('R-06').check).toMatchObject({ axis: 'y' });
  });

  it('SPEC-DEMO-01: spacing rects encode the 96 px design gap; mobile items have no design region', () => {
    const c = byId('R-06').check;
    if (c.kind !== 'spacing') throw new Error('R-06 must be spacing');
    expect(c.aRect && c.bRect && c.bRect.y - (c.aRect.y + c.aRect.h)).toBe(96);
    expect(byId('I-M-01').viewport).toBe('mobile');
    expect(byId('I-M-02').viewport).toBe('mobile');
    expect(byId('I-M-01').region).toBeUndefined();
    expect(byId('I-M-02').check.kind).toBe('visible');
  });

  it('SPEC-DEMO-01: passing items exist (logo and footer presence) so the Run shows Passes', () => {
    expect(byId('R-05').check.kind).toBe('presence');
    expect(byId('R-08').check.kind).toBe('presence');
  });

  it("SPEC-MEAS-07, SPEC-DEMO-01: snapping the suggestion returns every verified region within 2 px (source 'sample')", {
    timeout: 60_000,
  }, async () => {
    const design = await designAtCss();
    const desktop = contract.requirements.filter((r) => r.viewport === 'desktop');
    expect(desktop.length).toBe(Object.keys(SUGGESTED).length);
    for (const r of desktop) {
      const s = SUGGESTED[r.id];
      if (!s || !r.region || !('rect' in r.region)) throw new Error(`${r.id}: needs a resolved region`);
      expect(r.region.source, r.id).toBe('sample');
      const snapped = measureApi.snapRegion(design, s, thresholds());
      if (!('rect' in snapped)) throw new Error(`${r.id}: snap unresolved`);
      for (const k of ['x', 'y', 'w', 'h'] as const) {
        expect(Math.abs(snapped.rect[k] - r.region.rect[k]), `${r.id}.${k}`).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('pre-computed seed (SPEC 4.11.2, SPEC-DEMO-05)', () => {
  const pre = () => ({
    flawed: json('precomputed/flawed.json'),
    fixed: json('precomputed/fixed.json'),
    deep: json('precomputed/deep.json'),
    extraction: json('precomputed/extraction.json'),
  });

  it('SPEC-DEMO-05, SPEC-KERNEL-03: the four files assemble into a valid PrecomputedJudged', () => {
    expect(() => PrecomputedJudgedSchema.parse(pre())).not.toThrow();
    expect(() => DeepOutputSchema.parse(pre().deep)).not.toThrow();
  });

  it('SPEC-DEMO-01, PRD-M-01: defect 7 (R-07) is Needs review on flawed (never a High fail) and passes on fixed', () => {
    const p = PrecomputedJudgedSchema.parse(pre());
    const flawed = p.flawed['R-07:desktop'];
    expect(flawed).toBeDefined();
    expect(flawed?.verdict === 'fail' && flawed.confidence === 'high').toBe(false);
    expect(flawed?.verdict).not.toBe('pass');
    expect(p.fixed['R-07:desktop']?.verdict).toBe('pass');
  });

  it('SPEC-DEMO-05: every Judged requirement has a flawed and a fixed entry keyed reqId:viewport; no stray keys', () => {
    const p = PrecomputedJudgedSchema.parse(pre());
    const judged = contract.requirements.filter((r) => r.checkType === 'judged').map((r) => `${r.id}:${r.viewport}`);
    expect(Object.keys(p.flawed).sort()).toEqual([...judged].sort());
    expect(Object.keys(p.fixed).sort()).toEqual([...judged].sort());
  });

  it('SPEC-DEMO-05: precomputed extraction items are proposals (not accepted, origin precomputed)', () => {
    const items = pre().extraction as unknown[];
    expect(items.length).toBeGreaterThan(0);
    for (const raw of items) {
      const r = RequirementSchema.parse(raw);
      expect(r.accepted, r.id).toBe(false);
      expect(r.origin, r.id).toBe('precomputed');
    }
  });

  it('SPEC-DEMO-05: deep items refer to requirements that exist in the contract', () => {
    const p = PrecomputedJudgedSchema.parse(pre());
    expect(p.deep.items.length).toBeGreaterThan(0);
    for (const it of p.deep.items) {
      const [id, vp] = it.findingId.split(':');
      expect(
        contract.requirements.some((r) => r.id === id && r.viewport === vp),
        it.findingId,
      ).toBe(true);
    }
  });
});
