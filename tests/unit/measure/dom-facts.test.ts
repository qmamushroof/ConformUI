import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type DomSnapshot, DomSnapshotV1Schema } from '@kernel';
import { inlineMeasureClient, measureApi } from '@measure';
import { describe, expect, it } from 'vitest';
import { domElement, domSnapshot } from '../../helpers/samples';

const sampleDir = resolve(__dirname, '../../../src/features/demo/sample');
const load = (name: string): DomSnapshot =>
  DomSnapshotV1Schema.parse(JSON.parse(readFileSync(resolve(sampleDir, `${name}.dom.json`), 'utf8')));

const el = (i: number, over: Parameters<typeof domElement>[0] = {}) =>
  domElement({ i, parent: null, selector: `#e${i}`, ...over });
const snap = (...elements: ReturnType<typeof domElement>[]) => domSnapshot({ elements });

describe('SPEC-MEAS-14 matchElements', () => {
  it('SPEC-MEAS-14: selector is exact string equality', () => {
    const d = snap(el(0, { selector: '#cta' }), el(1, { selector: '#cta2' }));
    expect(measureApi.matchElements(d, { selector: '#cta' }).map((e) => e.i)).toEqual([0]);
    expect(measureApi.matchElements(d, { selector: '#CTA' })).toEqual([]);
  });

  it('SPEC-MEAS-14: tag and role filter; no filters match everything in document order', () => {
    const d = snap(
      el(0, { tag: 'a', role: 'link' }),
      el(1, { tag: 'button', role: 'button' }),
      el(2, { tag: 'a', role: undefined }),
    );
    expect(measureApi.matchElements(d, { tag: 'a' }).map((e) => e.i)).toEqual([0, 2]);
    expect(measureApi.matchElements(d, { role: 'button' }).map((e) => e.i)).toEqual([1]);
    expect(measureApi.matchElements(d, {}).map((e) => e.i)).toEqual([0, 1, 2]);
  });

  it('SPEC-MEAS-14: text is a case-insensitive, whitespace-collapsed substring', () => {
    const d = snap(el(0, { text: 'Start   FREE\n today' }), el(1, { text: 'Other' }), el(2, { text: undefined }));
    expect(measureApi.matchElements(d, { text: 'start free today' }).map((e) => e.i)).toEqual([0]);
    expect(measureApi.matchElements(d, { text: '  free  ' }).map((e) => e.i)).toEqual([0]);
    expect(measureApi.matchElements(d, { text: 'missing' })).toEqual([]);
  });

  it('SPEC-MEAS-14: within walks the parent chain, any depth', () => {
    const d = snap(
      el(0, { tag: 'nav', parent: null }),
      el(1, { tag: 'ul', parent: 0 }),
      el(2, { tag: 'a', parent: 1 }),
      el(3, { tag: 'a', parent: null }),
    );
    expect(measureApi.matchElements(d, { tag: 'a', within: { tag: 'nav' } }).map((e) => e.i)).toEqual([2]);
    expect(measureApi.matchElements(d, { tag: 'a', within: { tag: 'footer' } })).toEqual([]);
  });

  it('SPEC-MEAS-14: within with a nested within', () => {
    const d = snap(el(0, { tag: 'body' }), el(1, { tag: 'nav', parent: 0 }), el(2, { tag: 'a', parent: 1 }));
    const yes = { tag: 'a', within: { tag: 'nav', within: { tag: 'body' } } };
    const no = { tag: 'a', within: { tag: 'nav', within: { tag: 'main' } } };
    expect(measureApi.matchElements(d, yes).map((e) => e.i)).toEqual([2]);
    expect(measureApi.matchElements(d, no)).toEqual([]);
  });

  it('SPEC-MEAS-14: region keeps elements whose box centre is inside', () => {
    const d = snap(
      el(0, { box: { x: 0, y: 0, w: 20, h: 20 } }),
      el(1, { box: { x: 90, y: 90, w: 40, h: 40 } }),
      el(2, { box: { x: 90, y: 90, w: 20, h: 20 } }),
    );
    const region = { x: 0, y: 0, w: 100, h: 100 };
    expect(measureApi.matchElements(d, {}, region).map((e) => e.i)).toEqual([0]);
  });

  it('SPEC-MEAS-14: nth picks one after filtering (0-based); out of range gives empty', () => {
    const d = snap(el(0, { tag: 'a' }), el(1, { tag: 'p' }), el(2, { tag: 'a' }));
    expect(measureApi.matchElements(d, { tag: 'a', nth: 1 }).map((e) => e.i)).toEqual([2]);
    expect(measureApi.matchElements(d, { tag: 'a', nth: 0 }).map((e) => e.i)).toEqual([0]);
    expect(measureApi.matchElements(d, { tag: 'a', nth: 5 })).toEqual([]);
    expect(measureApi.matchElements(d, { tag: 'a', nth: -1 })).toEqual([]);
  });

  it('SPEC-MEAS-14: sorts into document order (by i) even when input is shuffled', () => {
    const d = snap(el(2), el(0), el(1));
    expect(measureApi.matchElements(d, {}).map((e) => e.i)).toEqual([0, 1, 2]);
  });
});

describe('SPEC-MEAS-13 overflowFacts', () => {
  it('SPEC-MEAS-13: horizontalPx = max(0, scrollWidth - clientWidth)', () => {
    const over = domSnapshot({ document: { scrollWidth: 454, scrollHeight: 10, clientWidth: 390 } });
    const under = domSnapshot({ document: { scrollWidth: 300, scrollHeight: 10, clientWidth: 390 } });
    expect(measureApi.overflowFacts(over).horizontalPx).toBe(64);
    expect(measureApi.overflowFacts(under).horizontalPx).toBe(0);
  });

  it('SPEC-MEAS-13: beyondViewport and clipped come from snapshot flags', () => {
    const flags = (beyondViewport: boolean, clippedByAncestor: boolean, textClipped: boolean) => ({
      flags: { beyondViewport, clippedByAncestor, textClipped },
    });
    const f = measureApi.overflowFacts(
      snap(el(0, flags(true, false, false)), el(1, flags(false, true, false)), el(2, flags(false, false, true)), el(3)),
    );
    expect(f.beyondViewport.map((e) => e.i)).toEqual([0]);
    expect(f.clipped.map((e) => e.i)).toEqual([1, 2]);
  });

  it('PRD-M-09, SPEC-MEAS-13: sample mobile flawed overflows by 64 px, fixed by 0', () => {
    expect(measureApi.overflowFacts(load('flawed-mobile')).horizontalPx).toBe(64);
    expect(measureApi.overflowFacts(load('fixed-mobile')).horizontalPx).toBe(0);
  });
});

describe('SPEC-MEAS-13 overlaps', () => {
  type Box = { x: number; y: number; w: number; h: number };
  const lm = (i: number, box: Box, over: Parameters<typeof domElement>[0] = {}) =>
    el(i, { kind: 'landmark', tag: 'section', box, ...over });

  it('SPEC-MEAS-13: reports intersection rect for overlapping non-related boxes', () => {
    const d = snap(lm(0, { x: 0, y: 0, w: 100, h: 100 }), lm(1, { x: 50, y: 50, w: 100, h: 100 }));
    const out = measureApi.overlaps(d);
    expect(out).toHaveLength(1);
    expect(out[0]?.[0].i).toBe(0);
    expect(out[0]?.[1].i).toBe(1);
    expect(out[0]?.[2]).toEqual({ x: 50, y: 50, w: 50, h: 50 });
  });

  it('SPEC-MEAS-13: ancestor/descendant pairs (any depth) are ignored', () => {
    const b = { x: 0, y: 0, w: 100, h: 100 };
    const d = snap(lm(0, b), lm(1, b, { parent: 0 }), lm(2, b, { parent: 1 }));
    expect(measureApi.overlaps(d)).toEqual([]);
  });

  it('SPEC-MEAS-13: invisible elements and kinds control/text are ignored', () => {
    const box = { x: 0, y: 0, w: 100, h: 100 };
    const d = snap(
      lm(0, box),
      lm(1, box, { visible: false }),
      el(2, { kind: 'text', box }),
      el(3, { kind: 'control', box }),
    );
    expect(measureApi.overlaps(d)).toEqual([]);
  });

  it('SPEC-MEAS-13: heading, button, link, image kinds are included', () => {
    const box = { x: 0, y: 0, w: 100, h: 100 };
    for (const k of ['heading', 'button', 'link', 'image'] as const) {
      expect(measureApi.overlaps(snap(lm(0, box), el(1, { kind: k, box }))), k).toHaveLength(1);
    }
  });

  it('SPEC-MEAS-13: area must be at least 16 px squared and at least 10% of the smaller box', () => {
    const big = { x: 0, y: 0, w: 1000, h: 1000 };
    expect(measureApi.overlaps(snap(lm(0, big), lm(1, { x: 10, y: 10, w: 4, h: 4 })))).toHaveLength(1);
    expect(measureApi.overlaps(snap(lm(0, big), lm(1, { x: 10, y: 10, w: 3, h: 5 })))).toEqual([]);
    const a = lm(0, { x: 0, y: 0, w: 100, h: 100 });
    expect(measureApi.overlaps(snap(a, lm(1, { x: 99, y: 99, w: 100, h: 100 })))).toEqual([]);
    expect(measureApi.overlaps(snap(a, lm(1, { x: 90, y: 0, w: 100, h: 100 })))).toHaveLength(1);
    expect(measureApi.overlaps(snap(a, lm(1, { x: 91, y: 0, w: 100, h: 100 })))).toEqual([]);
  });

  it('SPEC-MEAS-13: touching edges do not overlap; zero-size boxes ignored', () => {
    const d = snap(lm(0, { x: 0, y: 0, w: 100, h: 100 }), lm(1, { x: 100, y: 0, w: 100, h: 100 }));
    expect(measureApi.overlaps(d)).toEqual([]);
    const z = snap(lm(0, { x: 0, y: 0, w: 0, h: 0 }), lm(1, { x: 0, y: 0, w: 0, h: 0 }));
    expect(measureApi.overlaps(z)).toEqual([]);
  });

  it('PRD-M-09, SPEC-MEAS-13: sample mobile flawed has nav/h1 overlap, fixed has none', () => {
    const pairs = measureApi.overlaps(load('flawed-mobile')).map(([a, b]) => [a.tag, b.tag]);
    expect(pairs).toContainEqual(['nav', 'h1']);
    expect(measureApi.overlaps(load('fixed-mobile'))).toEqual([]);
  });
});

describe('SPEC-MEAS-15, SPEC-MEAS-16 client and purity', () => {
  it('SPEC-MEAS-15: inlineMeasureClient mirrors measureApi asynchronously', async () => {
    const c = inlineMeasureClient();
    const d = load('flawed-mobile');
    expect(await c.overflowFacts(d)).toEqual(measureApi.overflowFacts(d));
    expect(await c.pct(100, 110)).toBe(10);
    expect(await c.matchElements(d, { tag: 'h1' })).toEqual(measureApi.matchElements(d, { tag: 'h1' }));
    expect(c.pct(1, 2)).toBeInstanceOf(Promise);
  });

  it('SPEC-MEAS-15: client rejects (not throws synchronously) when the function throws', async () => {
    const c = inlineMeasureClient();
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    await expect(c.overflowFacts(undefined as any)).rejects.toThrow();
  });

  it('SPEC-MEAS-15: outputs are structured-clone safe', () => {
    const d = load('flawed-mobile');
    const out = [measureApi.overlaps(d), measureApi.overflowFacts(d), measureApi.matchElements(d, {})];
    expect(structuredClone(out)).toEqual(out);
  });

  it('PRD-M-09, SPEC-MEAS-16: two runs deep-equal and inputs are not mutated', () => {
    const d = load('flawed-mobile');
    const before = JSON.stringify(d);
    const run = () => [measureApi.overlaps(d), measureApi.overflowFacts(d), measureApi.matchElements(d, { tag: 'a' })];
    expect(run()).toEqual(run());
    expect(JSON.stringify(d)).toBe(before);
  });
});
