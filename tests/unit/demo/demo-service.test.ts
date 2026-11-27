import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ContractSchema, type Rect, type Requirement, RequirementSchema } from '@kernel';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  compareWithVerified,
  describeComparison,
  loadSampleAssets,
  overlapIgnoringCategory,
} from '../../../src/features/demo';

const repo = resolve(__dirname, '../../..');
const sampleDir = join(repo, 'src/features/demo/sample');

const req = (id: string, over: Partial<Requirement> & { rect?: Rect } = {}): Requirement => {
  const { rect, ...rest } = over;
  return {
    id,
    viewport: 'desktop',
    category: 'size',
    label: 'explicit',
    checkType: 'measured',
    statement: id,
    condition: id,
    check: { kind: 'layout-fits' },
    region: { rect: rect ?? { x: 0, y: 0, w: 100, h: 100 }, source: 'sample' },
    accepted: true,
    origin: 'sample',
    ...rest,
  };
};

describe('overlapIgnoringCategory (diagnostic only)', () => {
  it('counts verified items an AI item overlaps at IoU >= 0.5 in the same viewport, whatever the category', () => {
    const v = [req('V1'), req('V2', { rect: { x: 500, y: 500, w: 50, h: 50 } }), req('V3', { viewport: 'mobile' })];
    const ai = [
      req('A1', { category: 'presence' }),
      req('A2', { category: 'colour', rect: { x: 0, y: 0, w: 40, h: 100 } }),
    ];
    expect(overlapIgnoringCategory(ai, v).verifiedWithOverlap).toEqual(['V1']);
    // the match rule itself is unchanged: different category is still not a match
    expect(compareWithVerified(ai, v).matched).toEqual([]);
  });

  it('is empty for empty inputs and for items without a region', () => {
    expect(overlapIgnoringCategory([], []).verifiedWithOverlap).toEqual([]);
    const noRegion = { ...req('A'), region: undefined } as Requirement;
    expect(overlapIgnoringCategory([noRegion], [req('V')]).verifiedWithOverlap).toEqual([]);
  });
});

describe('compareWithVerified (SPEC-DEMO-03, PRD-M-14)', () => {
  it('SPEC-DEMO-03: identical lists give everything matched, nothing missing or extra', () => {
    const v = [req('A'), req('B', { category: 'spacing', rect: { x: 200, y: 0, w: 50, h: 50 } })];
    expect(compareWithVerified(v, v)).toEqual({ matched: ['A', 'B'], missing: [], extra: [] });
  });

  it('SPEC-DEMO-03: empty inputs give empty buckets; empty AI makes all verified missing; empty verified makes all AI extra', () => {
    expect(compareWithVerified([], [])).toEqual({ matched: [], missing: [], extra: [] });
    expect(compareWithVerified([], [req('V')])).toEqual({ matched: [], missing: ['V'], extra: [] });
    expect(compareWithVerified([req('X')], [])).toEqual({ matched: [], missing: [], extra: ['X'] });
  });

  it('SPEC-DEMO-03, SPEC-KERNEL-10: IoU exactly 0.5 matches; just below does not', () => {
    const v = [req('V', { rect: { x: 0, y: 0, w: 100, h: 100 } })];
    const half = req('A1', { rect: { x: 0, y: 0, w: 50, h: 100 } });
    expect(compareWithVerified([half], v).matched).toEqual(['A1']);
    const under = req('A2', { rect: { x: 0, y: 0, w: 49, h: 100 } });
    expect(compareWithVerified([under], v)).toEqual({ matched: [], missing: ['V'], extra: ['A2'] });
  });

  it('SPEC-DEMO-03: a different category or viewport never matches, even with identical rects', () => {
    const v = [req('V')];
    expect(compareWithVerified([req('A', { category: 'spacing' })], v).matched).toEqual([]);
    expect(compareWithVerified([req('A', { viewport: 'mobile' })], v).matched).toEqual([]);
  });

  it('SPEC-DEMO-03: matching is one-to-one (two AI items near one verified item: one match, one extra)', () => {
    expect(compareWithVerified([req('A1'), req('A2')], [req('V')])).toEqual({
      matched: ['A1'],
      missing: [],
      extra: ['A2'],
    });
  });

  it('SPEC-DEMO-03: an AI item takes the best-overlapping verified item, not the first', () => {
    const v = [
      req('V1', { rect: { x: 0, y: 0, w: 100, h: 100 } }),
      req('V2', { rect: { x: 60, y: 0, w: 100, h: 100 } }),
    ];
    const a = req('A', { rect: { x: 62, y: 0, w: 100, h: 100 } });
    expect(compareWithVerified([a], v)).toEqual({ matched: ['A'], missing: ['V1'], extra: [] });
  });

  it('SPEC-DEMO-03: no region never matches; an unresolved region compares by its suggested rect', () => {
    const noRegion = (id: string): Requirement => {
      const { region: _r, ...rest } = req(id);
      return rest;
    };
    const unresolved = (id: string): Requirement => ({
      ...req(id),
      region: { unresolved: true, suggested: { x: 0, y: 0, w: 100, h: 100 } },
    });
    expect(compareWithVerified([noRegion('A')], [req('V')])).toEqual({ matched: [], missing: ['V'], extra: ['A'] });
    expect(compareWithVerified([req('A')], [noRegion('V')])).toEqual({ matched: [], missing: ['V'], extra: ['A'] });
    expect(compareWithVerified([unresolved('A')], [req('V')]).matched).toEqual(['A']);
  });

  it('SPEC-DEMO-03: zero-area regions never match (IoU 0) and do not throw', () => {
    const z = req('Z', { rect: { x: 5, y: 5, w: 0, h: 0 } });
    expect(compareWithVerified([z], [z])).toEqual({ matched: [], missing: ['Z'], extra: ['Z'] });
  });

  it('SPEC-DEMO-03, PRD-M-14: the seeded extraction vs the verified Contract gives 7 matched, R-08 missing, 1 extra', () => {
    const verified = ContractSchema.parse(
      JSON.parse(readFileSync(join(sampleDir, 'contract.json'), 'utf8')),
    ).requirements.filter((r) => r.viewport === 'desktop');
    const ai = (JSON.parse(readFileSync(join(sampleDir, 'precomputed/extraction.json'), 'utf8')) as unknown[]).map(
      (r) => RequirementSchema.parse(r),
    );
    const res = compareWithVerified(ai, verified);
    expect(res.matched.length).toBe(7);
    expect(res.missing).toEqual(['R-08']);
    expect(res.extra.length).toBe(1);
  });
});

describe('loadSampleAssets (SPEC-DEMO-06)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (fail?: (url: string) => boolean) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (fail?.(url)) return new Response('nope', { status: 404 });
        const rel = decodeURIComponent(new URL(url, 'http://x').pathname).replace(/^.*\/features\/demo\/sample\//, '');
        const body = readFileSync(join(sampleDir, rel));
        return new Response(new Uint8Array(body), {
          headers: { 'content-type': rel.endsWith('.png') ? 'image/png' : 'application/json' },
        });
      }),
    );

  it('SPEC-DEMO-06, SPEC-DEMO-02: resolves design, flawed and fixed sets (both viewports), contract and precomputed', async () => {
    stubFetch();
    const a = await loadSampleAssets();
    expect(a.design.desktop.type).toBe('image/png');
    for (const set of [a.flawed, a.fixed]) {
      for (const vp of ['desktop', 'mobile'] as const) {
        expect(set[vp].image.type).toBe('image/png');
        expect(set[vp].image.size).toBeGreaterThan(1000);
        expect(set[vp].dom.schema).toBe('conformui.dom-snapshot');
      }
    }
    expect(a.flawed.mobile.dom.overflow.horizontalPx).toBe(64);
    expect(a.fixed.mobile.dom.overflow.horizontalPx).toBe(0);
    expect(a.contract.requirements.map((r) => r.id)).toContain('R-07');
    expect(Object.keys(a.precomputed.flawed)).toEqual(['R-07:desktop']);
    expect(a.precomputed.extraction.length).toBeGreaterThan(0);
  });

  it('SPEC-DEMO-06: a failed fetch rejects with a message naming the file (no partial result)', async () => {
    stubFetch((u) => u.includes('fixed-mobile.png'));
    await expect(loadSampleAssets()).rejects.toThrow(/fixed-mobile\.png/);
  });

  it('SPEC-DEMO-06, SPEC-KERNEL-03: a corrupt committed JSON file is rejected by schema validation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string | URL | Request) =>
        String(u).includes('.json')
          ? new Response('{"id":1}', { status: 200 })
          : new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
      ),
    );
    await expect(loadSampleAssets()).rejects.toThrow();
  });

  it('SPEC-DEMO-06: sample files load lazily (glob is not eager) and are never statically imported', () => {
    const src = readFileSync(join(repo, 'src/features/demo/assets.ts'), 'utf8');
    expect(src).toMatch(/import\.meta\.glob/);
    expect(src).not.toMatch(/eager\s*:\s*true/);
    expect(src).not.toMatch(/^import .*sample\//m);
    expect(src).not.toMatch(/console\./);
  });
});

describe('describeComparison (SPEC-DEMO-03)', () => {
  it('looks statements up on the side each id came from, even when AI and verified ids collide', () => {
    const verified = [
      req('R-08', { statement: 'The page ends with a footer', rect: { x: 0, y: 0, w: 10, h: 10 } }),
      req('I-M-02', { statement: 'Primary action stays visible', category: 'responsive' }),
    ];
    const ai = [req('R-08', { statement: 'The feature cards are 334 px wide', category: 'spacing' })];
    const out = describeComparison(ai, verified);
    expect(out.extra).toEqual([{ id: 'R-08', statement: 'The feature cards are 334 px wide' }]);
    expect(out.missing).toEqual([
      { id: 'R-08', statement: 'The page ends with a footer' },
      { id: 'I-M-02', statement: 'Primary action stays visible' },
    ]);
  });

  it('empty inputs give empty lists', () => {
    expect(describeComparison([], [])).toEqual({ matched: [], missing: [], extra: [] });
  });
});
