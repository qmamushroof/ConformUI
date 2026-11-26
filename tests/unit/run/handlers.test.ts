import type { Alignment, CheckSpec, DomElement, DomSnapshot, Rect, RgbaImage } from '@kernel';
import { inlineMeasureClient } from '@measure';
import { describe, expect, it } from 'vitest';
import { runHandler } from '../../../src/features/run/handlers';
import type { HandlerResult, ViewportCtx } from '../../../src/features/run/types';
import { solidImage } from '../../helpers/node-codec';
import { domElement, domSnapshot, imageRef, requirement, thresholds } from '../../helpers/samples';

// SPEC-RUN-03, SPEC-RUN-04, SPEC-ARCH-08: one test per row of the handler table, with and without a DOM snapshot.

type Rgba = [number, number, number, number];
const W = 400;
const H = 300;
const DARK: Rgba = [30, 30, 30, 255];
const WHITE: Rgba = [255, 255, 255, 255];

function paint(img: RgbaImage, r: Rect, rgba: Rgba): void {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) img.data.set(rgba, (y * img.width + x) * 4);
}
const page = (...blocks: [Rect, Rgba?][]): RgbaImage => {
  const img = solidImage(W, H, WHITE);
  for (const [r, c] of blocks) paint(img, r, c ?? DARK);
  return img;
};

const okAlignment: Alignment = { ok: true, widthDeltaPct: 0, heightDesign: H, heightCapture: H, issues: [] };
const badAlignment: Alignment = {
  ok: false,
  widthDeltaPct: 9,
  heightDesign: H,
  heightCapture: H,
  issues: ['width-mismatch'],
};

function ctx(
  o: { dom?: DomSnapshot; design?: RgbaImage; capture?: RgbaImage; alignment?: Alignment } = {},
): ViewportCtx {
  const hasDesign = o.design !== undefined;
  return {
    viewport: 'desktop',
    t: thresholds(),
    m: inlineMeasureClient(),
    ...(o.dom && { dom: o.dom }),
    ...(hasDesign && { designImage: imageRef({ width: W, height: H, cssWidth: W }) }),
    captureImage: imageRef({ width: W, height: H, cssWidth: W }),
    ...(hasDesign && { alignment: o.alignment ?? okAlignment }),
    designPx: async () => o.design,
    capturePx: async () => o.capture,
  };
}

const el = (over: Partial<DomElement> & { i: number }): DomElement => domElement(over);
const dom = (...elements: DomElement[]): DomSnapshot =>
  domSnapshot({
    elements,
    viewport: { width: W, height: H },
    document: { scrollWidth: W, scrollHeight: H, clientWidth: W },
  });

const R: Rect = { x: 100, y: 100, w: 100, h: 50 };
type Req = ReturnType<typeof requirement>;
const req = (check: CheckSpec, over: Partial<Req> = {}): Req =>
  requirement({ check, region: { rect: R, source: 'snapped' }, ...over });

const result = async (r: Req, v: ViewportCtx): Promise<Extract<HandlerResult, { kind: 'result' }>> => {
  const out = await runHandler(r, v);
  if (out.kind !== 'result') throw new Error('expected a result');
  return out;
};
const judge = async (r: Req, v: ViewportCtx): Promise<Extract<HandlerResult, { kind: 'judge' }>> => {
  const out = await runHandler(r, v);
  if (out.kind !== 'judge') throw new Error('expected a judge need');
  return out;
};

describe('presence, visual (SPEC-RUN-03, SPEC-MEAS-10)', () => {
  const r = req({ kind: 'presence', match: { tag: 'svg' } }, { checkType: 'visual' });

  it('SPEC-RUN-03: ink in the design and none in the implementation fails Critical, Medium, with ink measurements', async () => {
    const out = await result(r, ctx({ design: page([R]), capture: page() }));
    expect(out).toMatchObject({ status: 'fail', severity: 'critical', confidence: 'medium' });
    expect(out.facts.measurements[0]?.source).toEqual({ design: 'design-image', observed: 'capture-image' });
    expect(out.facts.designCrop).toEqual(R);
    expect(out.facts.captureCrop).toBeDefined();
  });

  it('SPEC-RUN-03: ink in both passes', async () => {
    expect(await result(r, ctx({ design: page([R]), capture: page([R]) }))).toMatchObject({
      status: 'pass',
      confidence: 'medium',
    });
  });

  it('SPEC-RUN-03: the DOM is ignored for visual presence (a visible DOM match does not rescue a blank region)', async () => {
    const v = ctx({ design: page([R]), capture: page(), dom: dom(el({ i: 0, tag: 'svg', box: R })) });
    expect((await result(r, v)).status).toBe('fail');
  });

  it('SPEC-RUN-04: width mismatch gives not-checked misaligned, never a number', async () => {
    const out = await result(r, ctx({ design: page([R]), capture: page(), alignment: badAlignment }));
    expect(out).toMatchObject({ status: 'not-checked', reason: 'misaligned' });
    expect(out.facts.measurements).toEqual([]);
  });

  it('SPEC-RUN-04, S21: an unresolved region is needs-review with the suggested rect as evidence', async () => {
    const un = req(
      { kind: 'presence', match: {} },
      { checkType: 'visual', region: { unresolved: true, suggested: R } },
    );
    const out = await result(un, ctx({ design: page([R]), capture: page() }));
    expect(out).toMatchObject({ status: 'needs-review', confidence: 'low' });
    expect(out.facts.designCrop).toEqual(R);
  });

  it('SPEC-RUN-04: a design region with no content cannot be tested: needs-review, not a pass', async () => {
    expect((await result(r, ctx({ design: page(), capture: page() }))).status).toBe('needs-review');
  });

  it('SPEC-RUN-04: no design image for the viewport is needs-review (region issue)', async () => {
    expect((await result(r, ctx({ capture: page() }))).status).toBe('needs-review');
  });
});

describe('presence, measured (SPEC-RUN-03)', () => {
  const r = req({ kind: 'presence', match: { tag: 'footer' } });

  it('SPEC-RUN-03: a visible DOM match passes at High, even when it is outside the region', async () => {
    const v = ctx({ dom: dom(el({ i: 0, tag: 'footer', kind: 'landmark', box: { x: 0, y: 250, w: 400, h: 40 } })) });
    expect(await result(r, v)).toMatchObject({ status: 'pass', confidence: 'high' });
  });

  it('SPEC-RUN-03: no match fails Critical at High with the expected region on the capture', async () => {
    const out = await result(r, ctx({ dom: dom(el({ i: 0, tag: 'header' })) }));
    expect(out).toMatchObject({ status: 'fail', severity: 'critical', confidence: 'high' });
    expect(out.facts.captureCrop).toEqual(R);
  });

  it('SPEC-RUN-03: an invisible match counts as missing', async () => {
    const out = await result(r, ctx({ dom: dom(el({ i: 0, tag: 'footer', visible: false })) }));
    expect(out.status).toBe('fail');
  });

  it('SPEC-RUN-03: without a DOM snapshot the ink test runs at Medium', async () => {
    expect(await result(r, ctx({ design: page([R]), capture: page() }))).toMatchObject({
      status: 'fail',
      severity: 'critical',
      confidence: 'medium',
    });
    expect(await result(r, ctx({ design: page([R]), capture: page([R]) }))).toMatchObject({ status: 'pass' });
  });
});

describe('count (SPEC-RUN-03)', () => {
  const r = req({ kind: 'count', match: { tag: 'a' }, expected: 4 });
  const links = (n: number) =>
    Array.from({ length: n }, (_, i) => el({ i, tag: 'a', kind: 'link', box: { x: i * 50, y: 10, w: 40, h: 20 } }));

  it('SPEC-RUN-03: equal count passes at High', async () => {
    expect(await result(r, ctx({ dom: dom(...links(4)) }))).toMatchObject({ status: 'pass', confidence: 'high' });
  });

  it('SPEC-RUN-03: 3 of 4 fails Major with a count measurement sourced from contract and DOM', async () => {
    const out = await result(r, ctx({ dom: dom(...links(3)) }));
    expect(out).toMatchObject({ status: 'fail', severity: 'major', confidence: 'high' });
    expect(out.facts.measurements[0]).toMatchObject({
      unit: 'count',
      design: 4,
      observed: 3,
      source: { design: 'contract', observed: 'dom-snapshot' },
    });
  });

  it('SPEC-RUN-03: invisible matches are not counted', async () => {
    const els = [...links(4).slice(0, 3), el({ i: 3, tag: 'a', kind: 'link', visible: false })];
    expect((await result(r, ctx({ dom: dom(...els) }))).status).toBe('fail');
  });

  it('SPEC-RUN-03: without a DOM the count is Judged, capped at Medium', async () => {
    expect(await judge(r, ctx({ design: page([R]), capture: page([R]) }))).toMatchObject({
      cap: 'medium',
      strict: false,
      severity: 'major',
    });
  });
});

describe('text (SPEC-RUN-03)', () => {
  const r = req({ kind: 'text', match: { tag: 'h1' }, expected: 'Plan your week' });

  it('SPEC-RUN-03: normalised containment passes (case, whitespace)', async () => {
    const v = ctx({ dom: dom(el({ i: 0, tag: 'h1', kind: 'heading', text: '  PLAN   your\nweek, calmly ' })) });
    expect(await result(r, v)).toMatchObject({ status: 'pass', confidence: 'high' });
  });

  it('SPEC-RUN-03: other text fails Major', async () => {
    const out = await result(r, ctx({ dom: dom(el({ i: 0, tag: 'h1', kind: 'heading', text: 'Welcome' })) }));
    expect(out).toMatchObject({ status: 'fail', severity: 'major', confidence: 'high' });
  });

  it('SPEC-RUN-03: no matching element fails, without a DOM it is Judged at Medium', async () => {
    expect((await result(r, ctx({ dom: dom(el({ i: 0, tag: 'p' })) }))).status).toBe('fail');
    expect(await judge(r, ctx({ design: page([R]), capture: page([R]) }))).toMatchObject({
      cap: 'medium',
      severity: 'major',
    });
  });
});

describe('size (SPEC-RUN-03, SPEC-MEAS-12)', () => {
  const r = req({ kind: 'size', match: { tag: 'a', text: 'Start' }, dimension: 'width' }, { primary: true });
  const cta = (w: number) =>
    dom(el({ i: 0, tag: 'a', kind: 'link', text: 'Start free', selector: '#cta', box: { x: 100, y: 100, w, h: 50 } }));

  it('SPEC-RUN-03: inside the tolerance passes at High', async () => {
    expect(await result(r, ctx({ dom: cta(104) }))).toMatchObject({ status: 'pass', confidence: 'high' });
  });

  it('SPEC-RUN-03: at the tolerance edge (8%) passes, just past it fails', async () => {
    expect((await result(r, ctx({ dom: cta(108) }))).status).toBe('pass');
    expect((await result(r, ctx({ dom: cta(109) }))).status).toBe('fail');
  });

  it('SPEC-RUN-03: a deviation below major_deviation_pct is Minor, at or above it Major (template wording)', async () => {
    const minor = await result(r, ctx({ dom: cta(85) }));
    expect(minor).toMatchObject({ status: 'fail', severity: 'minor' });
    const major = await result(r, ctx({ dom: cta(60) }));
    expect(major).toMatchObject({ status: 'fail', severity: 'major', confidence: 'high' });
    expect(major.statement).toBe(
      'Primary CTA is 60 px wide vs 100 px in the design (−40.0%), measured from DOM snapshot.',
    );
    expect(major.fix).toContain('#cta');
    expect(major.facts.selector).toBe('#cta');
    expect(major.facts.measurements[0]).toMatchObject({
      design: 100,
      observed: 60,
      deltaPct: -40,
      source: { design: 'design-image', observed: 'dom-snapshot' },
    });
  });

  it('SPEC-RUN-03: exactly major_deviation_pct (25%) is Major', async () => {
    expect((await result(r, ctx({ dom: cta(75) }))).severity).toBe('major');
  });

  it('SPEC-RUN-03: no matching element is needs-review', async () => {
    expect((await result(r, ctx({ dom: dom(el({ i: 0, tag: 'p' })) }))).status).toBe('needs-review');
  });

  it('SPEC-RUN-03, SPEC-MEAS-12: without a DOM the capture is located and snapped, at Medium', async () => {
    const out = await result(r, ctx({ design: page([R]), capture: page([{ ...R, w: 60 }]) }));
    expect(out).toMatchObject({ status: 'fail', severity: 'major', confidence: 'medium' });
    expect(out.facts.measurements[0]?.source).toEqual({ design: 'design-image', observed: 'capture-image' });
    expect((await result(r, ctx({ design: page([R]), capture: page([R]) }))).status).toBe('pass');
  });

  it('SPEC-RUN-04: an unlocatable capture region (score < 0.5) is needs-review, never a guessed number', async () => {
    const out = await result(r, ctx({ design: page([R]), capture: page() }));
    expect(out.status).toBe('needs-review');
    expect(out.facts.measurements).toEqual([]);
  });

  it('SPEC-RUN-04: width mismatch with no DOM is not-checked misaligned; with a DOM the measurement still runs', async () => {
    const noDom = await result(r, ctx({ design: page([R]), capture: page([R]), alignment: badAlignment }));
    expect(noDom).toMatchObject({ status: 'not-checked', reason: 'misaligned' });
    const withDom = await result(
      r,
      ctx({ dom: cta(60), design: page([R]), capture: page([R]), alignment: badAlignment }),
    );
    expect(withDom.status).toBe('fail');
  });

  it('SPEC-RUN-03: height uses the design region height', async () => {
    const h = req({ kind: 'size', match: { tag: 'a' }, dimension: 'height' });
    const out = await result(h, ctx({ dom: cta(100) }));
    expect(out.status).toBe('pass');
    expect(out.facts.measurements[0]).toMatchObject({ design: 50, observed: 50 });
  });

  it('SPEC-RUN-03, SPEC-RUN-04: with a DOM but no design region it is needs-review', async () => {
    const noRegion = req({ kind: 'size', match: { tag: 'a' }, dimension: 'width' }, { region: undefined });
    expect((await result(noRegion, ctx({ dom: cta(100) }))).status).toBe('needs-review');
  });
});

describe('spacing (SPEC-RUN-03, SPEC-MEAS-12)', () => {
  const aRect = { x: 0, y: 0, w: 100, h: 100 };
  const bRect = { x: 0, y: 196, w: 100, h: 20 }; // design gap 96
  const r = req({ kind: 'spacing', a: { tag: 'section' }, b: { tag: 'h2' }, axis: 'y', aRect, bRect });
  const layout = (gap: number) =>
    dom(
      el({ i: 0, tag: 'section', kind: 'landmark', box: { x: 0, y: 0, w: 100, h: 100 } }),
      el({ i: 1, tag: 'h2', kind: 'heading', box: { x: 0, y: 100 + gap, w: 100, h: 20 } }),
    );

  it('SPEC-RUN-03: gap within spacing_tolerance_pct passes at High', async () => {
    expect(await result(r, ctx({ dom: layout(90) }))).toMatchObject({ status: 'pass', confidence: 'high' });
  });

  it('SPEC-RUN-03: -33.3% fails Minor, at least 2x major_deviation_pct (50%) fails Major', async () => {
    const minor = await result(r, ctx({ dom: layout(64) }));
    expect(minor).toMatchObject({ status: 'fail', severity: 'minor', confidence: 'high' });
    expect(minor.facts.measurements[0]).toMatchObject({ design: 96, observed: 64, deltaPct: -33.3 });
    expect((await result(r, ctx({ dom: layout(40) }))).severity).toBe('major');
  });

  it('SPEC-RUN-03: a matcher with no result, or missing a/b rects, is needs-review', async () => {
    expect((await result(r, ctx({ dom: dom(el({ i: 0, tag: 'p' })) }))).status).toBe('needs-review');
    const noRects = req({ kind: 'spacing', a: { tag: 'section' }, b: { tag: 'h2' }, axis: 'y' });
    expect((await result(noRects, ctx({ dom: layout(64) }))).status).toBe('needs-review');
  });

  it('SPEC-RUN-03: without a DOM both rects are snapped on the capture and the result is Low (needs-review)', async () => {
    const design = page([aRect], [bRect]);
    const shifted = page([aRect], [{ ...bRect, y: 164 }]);
    const out = await result(r, ctx({ design, capture: shifted }));
    expect(out).toMatchObject({ status: 'needs-review', confidence: 'low' });
    expect(out.facts.measurements[0]).toMatchObject({ source: { design: 'design-image', observed: 'capture-image' } });
  });
});

describe('dominant-text (SPEC-RUN-03)', () => {
  const r = req({ kind: 'dominant-text', match: { tag: 'h1' } });
  const fs = (n: number): DomElement['style'] => ({ ...domElement().style, fontSize: n });

  it('SPEC-RUN-03: the match is at least as large as every other text element: pass at High', async () => {
    const v = ctx({
      dom: dom(
        el({ i: 0, tag: 'h1', kind: 'heading', text: 'Title', style: fs(56) }),
        el({ i: 1, tag: 'p', kind: 'text', text: 'Sub', style: fs(56) }),
        el({ i: 2, tag: 'img', kind: 'image', text: 'x', style: fs(80) }),
      ),
    });
    expect(await result(r, v)).toMatchObject({ status: 'pass', confidence: 'high' });
  });

  it('SPEC-RUN-03: a larger subtitle makes it fail Major; empty and invisible elements are ignored', async () => {
    const v = ctx({
      dom: dom(
        el({ i: 0, tag: 'h1', kind: 'heading', text: 'Title', style: fs(28) }),
        el({ i: 1, tag: 'p', kind: 'text', text: 'Sub', style: fs(32) }),
        el({ i: 2, tag: 'p', kind: 'text', text: '', name: '', style: fs(90) }),
        el({ i: 3, tag: 'p', kind: 'text', text: 'hidden', visible: false, style: fs(99) }),
      ),
    });
    const out = await result(r, v);
    expect(out).toMatchObject({ status: 'fail', severity: 'major', confidence: 'high' });
    expect(out.facts.measurements[0]).toMatchObject({ observed: 28, design: 32, unit: 'px' });
  });

  it('SPEC-RUN-03: without a DOM it is Judged at Medium', async () => {
    expect(await judge(r, ctx({ design: page([R]), capture: page([R]) }))).toMatchObject({
      cap: 'medium',
      severity: 'major',
    });
  });
});

describe('colour (SPEC-RUN-03, SPEC-MEAS-11)', () => {
  const r = req({ kind: 'colour', match: { tag: 'a' }, property: 'background' });
  const withBg = (bg: string) => dom(el({ i: 0, tag: 'a', style: { ...domElement().style, backgroundColor: bg } }));
  const design = page([R, [37, 99, 235, 255]]);

  it('SPEC-RUN-03: the same colour passes at High with a deltaE measurement', async () => {
    const out = await result(r, ctx({ dom: withBg('rgb(37, 99, 235)'), design, capture: page() }));
    expect(out).toMatchObject({ status: 'pass', confidence: 'high' });
    expect(out.facts.measurements[0]?.unit).toBe('deltaE');
  });

  it('SPEC-RUN-03: a distant colour fails Major above 3x the threshold, a near one fails Minor', async () => {
    const far = await result(r, ctx({ dom: withBg('rgb(220, 38, 38)'), design, capture: page() }));
    expect(far).toMatchObject({ status: 'fail', severity: 'major' });
    const near = await result(r, ctx({ dom: withBg('rgb(37, 99, 170)'), design, capture: page() }));
    expect(near).toMatchObject({ status: 'fail', severity: 'minor' });
  });

  it('SPEC-RUN-03: a transparent background reads the first opaque ancestor', async () => {
    const v = ctx({
      dom: dom(
        el({
          i: 0,
          tag: 'div',
          kind: 'landmark',
          style: { ...domElement().style, backgroundColor: 'rgb(37, 99, 235)' },
        }),
        el({ i: 1, parent: 0, tag: 'a', style: { ...domElement().style, backgroundColor: 'rgba(0, 0, 0, 0)' } }),
      ),
      design,
      capture: page(),
    });
    expect((await result(r, v)).status).toBe('pass');
  });

  it('SPEC-RUN-03, S21: without a DOM colour is Judged at Medium', async () => {
    expect(await judge(r, ctx({ design, capture: page() }))).toMatchObject({ cap: 'medium', strict: false });
  });

  it('SPEC-RUN-04: with a DOM but no design image the colour is needs-review', async () => {
    expect((await result(r, ctx({ dom: withBg('rgb(37, 99, 235)'), capture: page() }))).status).toBe('needs-review');
  });
});

describe('layout-fits (SPEC-RUN-03, SPEC-MEAS-13)', () => {
  const r = req({ kind: 'layout-fits' }, { region: undefined, label: 'inferred', viewport: 'mobile' });
  const fits = dom(el({ i: 0, kind: 'heading', tag: 'h1', box: { x: 0, y: 0, w: 100, h: 20 } }));

  it('SPEC-RUN-03: no overflow, overlap or clipping passes at High', async () => {
    expect(await result(r, ctx({ dom: fits }))).toMatchObject({ status: 'pass', confidence: 'high' });
  });

  it('SPEC-RUN-03: horizontal overflow fails Major with one statement listing the fact and a capture crop', async () => {
    const d = domSnapshot({
      elements: fits.elements,
      document: { scrollWidth: 454, scrollHeight: H, clientWidth: 390 },
      viewport: { width: 390, height: H },
    });
    const out = await result(r, ctx({ dom: d }));
    expect(out).toMatchObject({ status: 'fail', severity: 'major', confidence: 'high' });
    expect(out.statement).toContain('64 px');
    expect(out.facts.captureCrop).toBeDefined();
    expect(out.facts.measurements[0]).toMatchObject({ observed: 64, unit: 'px' });
  });

  it('SPEC-RUN-03: overlaps and clipped text each fail, all facts in one statement', async () => {
    const clipped = { beyondViewport: false, clippedByAncestor: false, textClipped: true };
    const d = dom(
      el({ i: 0, kind: 'landmark', tag: 'nav', box: { x: 0, y: 0, w: 300, h: 100 } }),
      el({ i: 1, kind: 'heading', tag: 'h1', box: { x: 10, y: 20, w: 200, h: 40 }, flags: clipped }),
    );
    const out = await result(r, ctx({ dom: d }));
    expect(out.status).toBe('fail');
    expect(out.statement).toMatch(/overlap/i);
    expect(out.statement).toMatch(/clipped/i);
  });

  it('SPEC-RUN-03: without a DOM snapshot it is not-checked no-dom-snapshot', async () => {
    expect(await result(r, ctx())).toMatchObject({ status: 'not-checked', reason: 'no-dom-snapshot' });
  });
});

describe('visible (SPEC-RUN-03)', () => {
  const r = req({ kind: 'visible', match: { tag: 'a', text: 'Start' } }, { region: undefined, label: 'inferred' });

  it('SPEC-RUN-03: visible and inside the viewport passes', async () => {
    expect((await result(r, ctx({ dom: dom(el({ i: 0, tag: 'a', text: 'Start free' })) }))).status).toBe('pass');
  });

  it('SPEC-RUN-03: beyondViewport, invisible or absent fails Major', async () => {
    const flags = { beyondViewport: true, clippedByAncestor: false, textClipped: false };
    expect(await result(r, ctx({ dom: dom(el({ i: 0, tag: 'a', text: 'Start free', flags })) }))).toMatchObject({
      status: 'fail',
      severity: 'major',
    });
    expect((await result(r, ctx({ dom: dom(el({ i: 0, tag: 'a', text: 'Start', visible: false })) }))).status).toBe(
      'fail',
    );
    expect((await result(r, ctx({ dom: dom(el({ i: 0, tag: 'p' })) }))).status).toBe('fail');
  });

  it('SPEC-RUN-03: without a DOM snapshot it is not-checked no-dom-snapshot', async () => {
    expect(await result(r, ctx())).toMatchObject({ status: 'not-checked', reason: 'no-dom-snapshot' });
  });
});

describe('region-diff, visual (SPEC-RUN-03, SPEC-MEAS-09)', () => {
  const r = req({ kind: 'region-diff' }, { checkType: 'visual' });

  it('SPEC-RUN-03: identical regions pass at Medium', async () => {
    expect(await result(r, ctx({ design: page([R]), capture: page([R]) }))).toMatchObject({
      status: 'pass',
      confidence: 'medium',
    });
  });

  it('SPEC-RUN-03: a different region fails, Major from 2x visual_diff_ratio, with the ratio as evidence', async () => {
    const out = await result(
      r,
      ctx({ design: page([R]), capture: page([R], [{ ...R, x: 140, w: 60 }, [200, 30, 30, 255]]) }),
    );
    expect(out.status).toBe('fail');
    expect(out.facts.diffRatio).toBeGreaterThan(0.2);
    expect(out.severity).toBe('major');
  });

  it('SPEC-RUN-03: a small difference is Minor', async () => {
    const out = await result(
      r,
      ctx({ design: page([R]), capture: page([R], [{ x: 100, y: 100, w: 100, h: 12 }, WHITE]) }),
    );
    expect(out).toMatchObject({ status: 'fail', severity: 'minor' });
  });

  it('SPEC-RUN-04: misaligned is not-checked, a missing design is needs-review', async () => {
    const bad = await result(r, ctx({ design: page([R]), capture: page([R]), alignment: badAlignment }));
    expect(bad).toMatchObject({ status: 'not-checked', reason: 'misaligned' });
    expect((await result(r, ctx({ capture: page([R]) }))).status).toBe('needs-review');
  });
});

describe('position and judged (SPEC-RUN-03, SPEC-RUN-04)', () => {
  it('SPEC-RUN-03: position and judged always go to the AI judge, strict (a fail needs High)', async () => {
    const p = req({ kind: 'position', match: { tag: 'a' }, axis: 'x' }, { checkType: 'judged' });
    const j = req({ kind: 'judged', question: 'Same colour?' }, { checkType: 'judged' });
    for (const x of [p, j]) {
      expect(await judge(x, ctx({ dom: dom(el({ i: 0 })), design: page([R]), capture: page([R]) }))).toMatchObject({
        strict: true,
        cap: 'high',
        severity: 'major',
      });
    }
  });

  it('SPEC-RUN-03: checkType judged on any other kind also takes the strict judge path', async () => {
    const c = req({ kind: 'colour', match: { tag: 'a' }, property: 'background' }, { checkType: 'judged' });
    expect(await judge(c, ctx({ dom: dom(el({ i: 0 })) }))).toMatchObject({ strict: true });
  });

  it('SPEC-ARCH-08: the handler registry has exactly one entry per CheckSpec kind', async () => {
    const { HANDLERS } = await import('../../../src/features/run/handlers');
    expect(Object.keys(HANDLERS).sort()).toEqual([
      'colour',
      'count',
      'dominant-text',
      'judged',
      'layout-fits',
      'position',
      'presence',
      'region-diff',
      'size',
      'spacing',
      'text',
      'visible',
    ]);
  });
});
