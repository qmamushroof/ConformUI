import type { CheckSpec, DomElement, Measurement, Oklab, Rect, Requirement, RgbaImage, Severity } from '@kernel';
import { colourMeasurement, gapBetween, geometryMeasurement, rgbToOklab } from '@measure';
import type { Facts, HandlerResult, JudgeNeed, ResultOutcome, ViewportCtx } from './types';

// Check handlers (SPEC-RUN-03, SPEC-RUN-04, SPEC-ARCH-08): one handler per `CheckSpec.kind`, `checkType` and the
// presence of a DOM snapshot select the path. A handler never guesses: when it cannot measure it says so.

type Kind = CheckSpec['kind'];
type Req<K extends Kind> = Requirement & { check: Extract<CheckSpec, { kind: K }> };
type Handler<K extends Kind> = (req: Req<K>, v: ViewportCtx) => Promise<HandlerResult>;

const NO_FACTS: Facts = { measurements: [] };

// ---- small helpers ---------------------------------------------------------------------------------------------

const resolvedRect = (r: Requirement): Rect | undefined => (r.region && 'rect' in r.region ? r.region.rect : undefined);
const suggestedRect = (r: Requirement): Rect | undefined =>
  r.region && 'unresolved' in r.region ? r.region.suggested : undefined;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const roundRect = (r: Rect): Rect => ({
  x: Math.round(r.x),
  y: Math.round(r.y),
  w: Math.round(r.w),
  h: Math.round(r.h),
});
const scaleRect = (r: Rect, s: number): Rect => ({ x: r.x * s, y: r.y * s, w: r.w * s, h: r.h * s });
const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function union(rs: Rect[]): Rect | undefined {
  if (rs.length === 0) return undefined;
  const x0 = Math.min(...rs.map((r) => r.x));
  const y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.h));
  return roundRect({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
}
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const signedPct = (p: number) => `${p < 0 ? '−' : '+'}${Math.abs(p).toFixed(1)}%`;
const short = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const VIEWPORT_WIDTH = (v: ViewportCtx) => v.captureImage.cssWidth;

function scaleOf(v: ViewportCtx): number {
  return v.designImage && v.designImage.cssWidth > 0 ? v.captureImage.cssWidth / v.designImage.cssWidth : 1;
}

const NOUN: Record<string, string> = {
  h1: 'headline',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  a: 'link',
  button: 'button',
  img: 'image',
};

/** A human label for the element a statement is about; never a raw CSS selector (that stays in facts and the fix). */
function subject(req: Requirement, m?: { text?: string; tag?: string }, el?: DomElement): string {
  if (req.primary) return 'Primary CTA';
  if (m?.text) return `"${m.text}"`;
  const tag = m?.tag ?? el?.tag;
  const words = (el?.text ?? el?.name ?? '').trim();
  const noun = tag ? NOUN[tag.toLowerCase()] : undefined;
  if (words) return `The ${noun ?? 'element'} "${short(words, 50)}"`;
  if (tag) return `The <${tag}>`;
  return 'The element';
}

/** Fail severity when a number does not decide it (region issues, AI answers): the lowest the table gives. */
function baseSeverity(req: Requirement): Severity {
  switch (req.check.kind) {
    case 'presence':
      return 'critical';
    case 'size':
    case 'spacing':
    case 'colour':
    case 'region-diff':
      return 'minor';
    default:
      return 'major';
  }
}

const done = (o: Omit<ResultOutcome, 'kind'>): ResultOutcome => ({ kind: 'result', ...o });

function judgeNeed(req: Requirement, o: { cap: JudgeNeed['cap']; strict: boolean }): JudgeNeed {
  const designCrop = resolvedRect(req) ?? suggestedRect(req);
  return {
    kind: 'judge',
    cap: o.cap,
    strict: o.strict,
    severity: baseSeverity(req),
    facts: { measurements: [], ...(designCrop && { designCrop: roundRect(designCrop) }) },
  };
}

/** SPEC-RUN-04: the design region (or image) cannot be used: needs-review, with the suggested rect as evidence. */
function regionIssue(req: Requirement, hint: string): ResultOutcome {
  const designCrop = resolvedRect(req) ?? suggestedRect(req);
  return done({
    status: 'needs-review',
    confidence: 'low',
    severity: baseSeverity(req),
    hint,
    statement: `This item could not be measured because ${hint}. Check it by eye against the design.`,
    fix: 'Check this item against the design, or re-open the contract to fix its region.',
    facts: { measurements: [], ...(designCrop && { designCrop: roundRect(designCrop) }) },
  });
}

const misaligned = (req: Requirement): ResultOutcome =>
  done({
    status: 'not-checked',
    reason: 'misaligned',
    confidence: 'low',
    hint: 'The capture width differs from the design width',
    facts: { measurements: [], ...(resolvedRect(req) && { designCrop: roundRect(resolvedRect(req) as Rect) }) },
  });

interface ImageSet {
  region: Rect;
  design: RgbaImage;
  capture: RgbaImage;
}

/** Common gate of every image handler: region, design, capture and alignment (SPEC-RUN-04). */
async function imageGate(
  req: Requirement,
  v: ViewportCtx,
  region = resolvedRect(req),
): Promise<{ stop: ResultOutcome } | { images: ImageSet }> {
  if (!region) return { stop: regionIssue(req, 'the design region could not be resolved') };
  const design = await v.designPx();
  if (!design) return { stop: regionIssue(req, 'there is no design image for this viewport') };
  const capture = await v.capturePx();
  if (!capture)
    return { stop: done({ status: 'not-checked', reason: 'no-capture', confidence: 'low', facts: NO_FACTS }) };
  if (v.alignment && !v.alignment.ok) return { stop: misaligned(req) };
  return { images: { region, design, capture } };
}

const regionOn = (req: Requirement, v: ViewportCtx): Rect | undefined => {
  const r = resolvedRect(req);
  return r ? scaleRect(r, scaleOf(v)) : undefined;
};

/** Visible matches; with several, those touching the region win (position drift is Judged-only, S21). */
async function find(v: ViewportCtx, m: Parameters<ViewportCtx['m']['matchElements']>[1], region?: Rect, any = false) {
  if (!v.dom) return [];
  const all = (await v.m.matchElements(v.dom, m)).filter((e) => any || e.visible);
  if (!region || all.length <= 1) return all;
  const inside = all.filter((e) => intersects(e.box, region));
  return inside.length > 0 ? inside : all;
}

function parseColour(css: string): { lab: Oklab; alpha: number } | undefined {
  const m =
    /^rgba?\(\s*(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*\.?\d+%?))?\s*\)$/i.exec(
      css.trim(),
    );
  if (!m) return undefined;
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number.parseFloat(m[4]) / 100 : Number(m[4]);
  return { lab: rgbToOklab(Number(m[1]), Number(m[2]), Number(m[3])), alpha: a };
}

/** Computed colour of `el`; a transparent background reads the nearest opaque ancestor. */
function observedColour(dom: NonNullable<ViewportCtx['dom']>, el: DomElement, property: 'background' | 'text') {
  const byIndex = new Map(dom.elements.map((e) => [e.i, e]));
  let cur: DomElement | undefined = el;
  for (let hops = 0; cur && hops < 64; hops++) {
    const c = parseColour(property === 'text' ? cur.style.color : cur.style.backgroundColor);
    if (c && (property === 'text' || c.alpha > 0)) return c.lab;
    if (property === 'text') return undefined;
    cur = cur.parent === null ? undefined : byIndex.get(cur.parent);
  }
  return undefined;
}

// ---- presence --------------------------------------------------------------------------------------------------

/** SPEC-MEAS-10 ink test at the located rect (visual, or measured without a DOM snapshot). */
async function presenceByInk(req: Requirement, v: ViewportCtx): Promise<HandlerResult> {
  const gate = await imageGate(req, v);
  if ('stop' in gate) return gate.stop;
  const { region, design, capture } = gate.images;
  const { t } = v;
  const designInk = await v.m.inkRatio(design, region);
  if (designInk < 3 * t.presence_ink_ratio) {
    return regionIssue(req, 'the design region has no content to compare');
  }
  const located = await v.m.locateOnCapture(design, region, capture, t);
  const where = located.score < 0.5 ? region : located.rect;
  const captureInk = await v.m.inkRatio(capture, where);
  const measurement: Measurement = {
    name: 'Ink coverage',
    design: round1(designInk * 100),
    observed: round1(captureInk * 100),
    unit: '%',
    delta: round1((captureInk - designInk) * 100),
    source: { design: 'design-image', observed: 'capture-image' },
  };
  const facts: Facts = { measurements: [measurement], designCrop: roundRect(region), captureCrop: roundRect(where) };
  if (captureInk >= t.presence_ink_ratio) return done({ status: 'pass', confidence: 'medium', facts });
  return done({
    status: 'fail',
    confidence: 'medium',
    severity: 'critical',
    statement: `Nothing is drawn where the design shows content: ${req.statement} (ink ${measurement.design}% in the design vs ${measurement.observed}% in the implementation), measured from images.`,
    fix: 'Add the missing element at the position shown in the design.',
    facts,
  });
}

const presence: Handler<'presence'> = async (req, v) => {
  if (req.checkType === 'visual' || !v.dom) return presenceByInk(req, v);
  const region = regionOn(req, v);
  const found = await find(v, req.check.match, region);
  const designCrop = resolvedRect(req);
  const facts: Facts = {
    measurements: [
      {
        name: 'Matching elements',
        observed: found.length,
        unit: 'count',
        source: { observed: 'dom-snapshot' },
      },
    ],
    ...(designCrop && { designCrop: roundRect(designCrop) }),
  };
  const first = found[0];
  if (first) {
    return done({
      status: 'pass',
      confidence: 'high',
      facts: { ...facts, selector: first.selector, captureCrop: roundRect(first.box) },
    });
  }
  return done({
    status: 'fail',
    confidence: 'high',
    severity: 'critical',
    statement: `${req.statement}: no visible element matches in the DOM snapshot.`,
    fix: 'Add the missing element so it is rendered and visible.',
    facts: { ...facts, ...(region && { captureCrop: roundRect(region) }) },
  });
};

// ---- count, text -----------------------------------------------------------------------------------------------

const count: Handler<'count'> = async (req, v) => {
  if (!v.dom) return judgeNeed(req, { cap: 'medium', strict: false });
  const found = await find(v, req.check.match);
  const expected = req.check.expected;
  const designCrop = resolvedRect(req);
  const captureCrop = union(found.map((e) => e.box)) ?? (regionOn(req, v) && roundRect(regionOn(req, v) as Rect));
  const facts: Facts = {
    measurements: [
      {
        name: 'Matching elements',
        design: expected,
        observed: found.length,
        unit: 'count',
        delta: found.length - expected,
        source: { design: 'contract', observed: 'dom-snapshot' },
      },
    ],
    ...(designCrop && { designCrop: roundRect(designCrop) }),
    ...(captureCrop && { captureCrop }),
  };
  if (found.length === expected) return done({ status: 'pass', confidence: 'high', facts });
  return done({
    status: 'fail',
    confidence: 'high',
    severity: 'major',
    statement: `${req.statement}: found ${found.length} visible matching elements, expected ${expected}, measured from DOM snapshot.`,
    fix: `Render exactly ${expected} of these elements.`,
    facts,
  });
};

const text: Handler<'text'> = async (req, v) => {
  if (!v.dom) return judgeNeed(req, { cap: 'medium', strict: false });
  const found = await find(v, req.check.match);
  const wanted = norm(req.check.expected);
  const hit = found.find((e) => norm(e.text ?? e.name ?? '').includes(wanted));
  const designCrop = resolvedRect(req);
  const region = regionOn(req, v);
  const shown = hit ?? found[0];
  const facts: Facts = {
    measurements: [],
    ...(designCrop && { designCrop: roundRect(designCrop) }),
    ...(shown
      ? { captureCrop: roundRect(shown.box), selector: shown.selector }
      : region && { captureCrop: roundRect(region) }),
  };
  if (hit) return done({ status: 'pass', confidence: 'high', facts });
  const seen = shown ? `found "${short(shown.text ?? shown.name ?? '', 60)}"` : 'no matching element';
  return done({
    status: 'fail',
    confidence: 'high',
    severity: 'major',
    statement: `${req.statement}: expected text "${short(req.check.expected, 60)}", ${seen}, measured from DOM snapshot.`,
    fix: `Change the text to "${short(req.check.expected, 80)}".`,
    facts,
  });
};

// ---- size, spacing ---------------------------------------------------------------------------------------------

const sizeSeverity = (pct: number, major: number): Severity => (Math.abs(pct) >= major ? 'major' : 'minor');

const size: Handler<'size'> = async (req, v) => {
  const { dimension } = req.check;
  const region = resolvedRect(req);
  const word = dimension === 'width' ? 'wide' : 'high';
  const designValue = region ? (dimension === 'width' ? region.w : region.h) : 0;
  const width = VIEWPORT_WIDTH(v);

  if (v.dom) {
    if (!region) return regionIssue(req, 'the design region could not be resolved');
    const [el] = await find(v, req.check.match, regionOn(req, v));
    if (!el) return regionIssue(req, 'no element in the DOM snapshot matches this item');
    const observed = dimension === 'width' ? el.box.w : el.box.h;
    const who = subject(req, req.check.match, el);
    const { measurement, pass } = geometryMeasurement(
      'size',
      `${who} ${dimension}`,
      designValue,
      observed,
      'dom-snapshot',
      v.t,
    );
    const facts: Facts = {
      measurements: [measurement],
      selector: el.selector,
      designCrop: roundRect(region),
      captureCrop: roundRect(el.box),
    };
    if (pass) return done({ status: 'pass', confidence: 'high', facts });
    const pct = measurement.deltaPct ?? 0;
    return done({
      status: 'fail',
      confidence: 'high',
      severity: sizeSeverity(pct, v.t.major_deviation_pct),
      statement: `${who} is ${measurement.observed} px ${word} vs ${measurement.design} px in the design (${signedPct(pct)}), measured from DOM snapshot.`,
      fix: `Make \`${el.selector}\` ${measurement.design} px ${dimension} (or match the design's ${dimension} rule) at a ${width} px viewport.`,
      facts,
    });
  }

  const gate = await imageGate(req, v);
  if ('stop' in gate) return gate.stop;
  const { design, capture } = gate.images;
  const located = await v.m.locateOnCapture(design, gate.images.region, capture, v.t);
  if (located.score < 0.5) return regionIssue(req, 'the region could not be located on the capture');
  const snapped = await v.m.snapRegion(capture, located.rect, v.t);
  if ('unresolved' in snapped) return regionIssue(req, 'the element could not be outlined on the capture');
  const observed = dimension === 'width' ? snapped.rect.w : snapped.rect.h;
  const who = subject(req, req.check.match);
  const { measurement, pass } = geometryMeasurement(
    'size',
    `${who} ${dimension}`,
    designValue,
    observed,
    'capture-image',
    v.t,
  );
  const facts: Facts = {
    measurements: [measurement],
    designCrop: roundRect(gate.images.region),
    captureCrop: roundRect(snapped.rect),
  };
  if (pass) return done({ status: 'pass', confidence: 'medium', facts });
  const pct = measurement.deltaPct ?? 0;
  return done({
    status: 'fail',
    confidence: 'medium',
    severity: sizeSeverity(pct, v.t.major_deviation_pct),
    statement: `${who} is ${measurement.observed} px ${word} vs ${measurement.design} px in the design (${signedPct(pct)}), measured from images.`,
    fix: `Make this element ${measurement.design} px ${dimension} (or match the design's ${dimension} rule) at a ${width} px viewport.`,
    facts,
  });
};

const spacing: Handler<'spacing'> = async (req, v) => {
  const { a, b, axis, aRect, bRect } = req.check;
  if (!aRect || !bRect) return regionIssue(req, 'the design rects of both elements are missing');
  const designGap = Math.round(gapBetween(aRect, bRect, axis));
  const designCrop = union([aRect, bRect]);
  const word = axis === 'y' ? 'vertical' : 'horizontal';

  if (v.dom) {
    const s = scaleOf(v);
    const [ea] = await find(v, a, scaleRect(aRect, s));
    const [eb] = await find(v, b, scaleRect(bRect, s));
    if (!ea || !eb) return regionIssue(req, 'no element in the DOM snapshot matches one side of this item');
    const { measurement, pass } = geometryMeasurement(
      'gap',
      `${word} gap`,
      designGap,
      gapBetween(ea.box, eb.box, axis),
      'dom-snapshot',
      v.t,
    );
    const facts: Facts = {
      measurements: [measurement],
      selector: eb.selector,
      ...(designCrop && { designCrop }),
      ...(union([ea.box, eb.box]) && { captureCrop: union([ea.box, eb.box]) as Rect }),
    };
    if (pass) return done({ status: 'pass', confidence: 'high', facts });
    const pct = measurement.deltaPct ?? 0;
    return done({
      status: 'fail',
      confidence: 'high',
      severity: Math.abs(pct) >= 2 * v.t.major_deviation_pct ? 'major' : 'minor',
      statement: `The ${word} gap is ${measurement.observed} px vs ${measurement.design} px in the design (${signedPct(pct)}), measured from DOM snapshot.`,
      fix: `Set the space between \`${ea.selector}\` and \`${eb.selector}\` to ${measurement.design} px.`,
      facts,
    });
  }

  // Without a DOM: snap both rects on the capture; the result is Low, so never better than Needs review.
  const gate = await imageGate(req, v, aRect);
  if ('stop' in gate) return gate.stop;
  const { design, capture } = gate.images;
  const places: Rect[] = [];
  for (const r of [aRect, bRect]) {
    const located = await v.m.locateOnCapture(design, r, capture, v.t);
    if (located.score < 0.5) return regionIssue(req, 'a region could not be located on the capture');
    const snapped = await v.m.snapRegion(capture, located.rect, v.t);
    if ('unresolved' in snapped) return regionIssue(req, 'an element could not be outlined on the capture');
    places.push(snapped.rect);
  }
  const [pa, pb] = places as [Rect, Rect];
  const { measurement, pass } = geometryMeasurement(
    'gap',
    `${word} gap`,
    designGap,
    gapBetween(pa, pb, axis),
    'capture-image',
    v.t,
  );
  const pct = measurement.deltaPct ?? 0;
  return done({
    status: 'needs-review',
    confidence: 'low',
    severity: Math.abs(pct) >= 2 * v.t.major_deviation_pct ? 'major' : 'minor',
    statement: pass
      ? `The ${word} gap is ${measurement.observed} px vs ${measurement.design} px in the design (${signedPct(pct)}), measured from images only: confirm by eye.`
      : `The ${word} gap looks like ${measurement.observed} px vs ${measurement.design} px in the design (${signedPct(pct)}), measured from images only: confirm by eye.`,
    fix: `Set the ${word} space between the two elements to ${measurement.design} px.`,
    facts: {
      measurements: [measurement],
      ...(designCrop && { designCrop }),
      ...(union([pa, pb]) && { captureCrop: union([pa, pb]) as Rect }),
    },
  });
};

// ---- dominant-text, colour -------------------------------------------------------------------------------------

const TEXT_KINDS = new Set<DomElement['kind']>(['heading', 'text', 'link', 'button']);

const dominantText: Handler<'dominant-text'> = async (req, v) => {
  if (!v.dom) return judgeNeed(req, { cap: 'medium', strict: false });
  const [el] = await find(v, req.check.match, regionOn(req, v));
  const designCrop = resolvedRect(req);
  if (!el) return regionIssue(req, 'no element in the DOM snapshot matches this item');
  const others = v.dom.elements.filter(
    (e) =>
      e.i !== el.i &&
      e.visible &&
      TEXT_KINDS.has(e.kind) &&
      ((e.text ?? '').trim() !== '' || (e.name ?? '').trim() !== ''),
  );
  const biggest = others.reduce<DomElement | undefined>(
    (best, e) => (!best || e.style.fontSize > best.style.fontSize ? e : best),
    undefined,
  );
  const who = subject(req, req.check.match, el);
  const measurement: Measurement = {
    name: `${who} font size vs the largest other text`,
    design: biggest?.style.fontSize ?? el.style.fontSize,
    observed: el.style.fontSize,
    unit: 'px',
    delta: round1(el.style.fontSize - (biggest?.style.fontSize ?? el.style.fontSize)),
    source: { design: 'dom-snapshot', observed: 'dom-snapshot' },
  };
  const facts: Facts = {
    measurements: [measurement],
    selector: el.selector,
    ...(designCrop && { designCrop: roundRect(designCrop) }),
    captureCrop: roundRect(el.box),
  };
  if (!biggest || el.style.fontSize >= biggest.style.fontSize)
    return done({ status: 'pass', confidence: 'high', facts });
  return done({
    status: 'fail',
    confidence: 'high',
    severity: 'major',
    statement: `${who} is ${el.style.fontSize} px, smaller than other text at ${biggest.style.fontSize} px, so it is not the dominant text; measured from DOM snapshot.`,
    fix: `Make \`${el.selector}\` larger than every other text on the page (more than ${biggest.style.fontSize} px).`,
    facts,
  });
};

const colour: Handler<'colour'> = async (req, v) => {
  if (!v.dom) return judgeNeed(req, { cap: 'medium', strict: false });
  const { property } = req.check;
  const region = resolvedRect(req);
  if (!region) return regionIssue(req, 'the design region could not be resolved');
  const design = await v.designPx();
  if (!design) return regionIssue(req, 'there is no design image for this viewport');
  const [el] = await find(v, req.check.match, regionOn(req, v));
  if (!el) return regionIssue(req, 'no element in the DOM snapshot matches this item');
  const seen = observedColour(v.dom, el, property);
  if (!seen) return regionIssue(req, 'the element colour could not be read from the DOM snapshot');
  const designColour = await v.m.dominantColour(design, region, property);
  const who = subject(req, req.check.match, el);
  const made = colourMeasurement(`${who} ${property} colour`, designColour, seen, v.t);
  const measurement: Measurement = {
    ...made.measurement,
    observed: round3(made.measurement.observed ?? 0),
    delta: round3(made.measurement.delta ?? 0),
  };
  const facts: Facts = {
    measurements: [measurement],
    selector: el.selector,
    designCrop: roundRect(region),
    captureCrop: roundRect(el.box),
  };
  if (made.pass) return done({ status: 'pass', confidence: 'high', facts });
  const de = measurement.observed ?? 0;
  return done({
    status: 'fail',
    confidence: 'high',
    severity: de > 3 * v.t.colour_delta_e ? 'major' : 'minor',
    statement: `${who} ${property} colour differs from the design (deltaE ${de.toFixed(2)} vs a limit of ${v.t.colour_delta_e}), measured from DOM snapshot and design image.`,
    fix: `Use the design's ${property} colour on \`${el.selector}\`.`,
    facts,
  });
};

// ---- layout-fits, visible --------------------------------------------------------------------------------------

const layoutFits: Handler<'layout-fits'> = async (_req, v) => {
  const dom = v.dom;
  if (!dom) return done({ status: 'not-checked', reason: 'no-dom-snapshot', confidence: 'low', facts: NO_FACTS });
  const [facts0, pairs] = await Promise.all([v.m.overflowFacts(dom), v.m.overlaps(dom)]);
  const clipped = facts0.clipped;
  const fact = (name: string, observed: number, unit: Measurement['unit']): Measurement => ({
    name,
    design: 0,
    observed,
    unit,
    delta: observed,
    source: { design: 'contract', observed: 'dom-snapshot' },
  });
  const measurements = [
    fact('Horizontal overflow', facts0.horizontalPx, 'px'),
    fact('Overlapping pairs', pairs.length, 'count'),
    fact('Clipped text elements', clipped.length, 'count'),
  ];
  const label = (e: DomElement) => short(e.name ?? e.text ?? `<${e.tag}>`);
  const parts: string[] = [];
  if (facts0.horizontalPx > 0) parts.push(`${facts0.horizontalPx} px of horizontal overflow`);
  if (pairs.length > 0) {
    const first = pairs[0] as (typeof pairs)[number];
    parts.push(
      `${pairs.length} overlapping ${pairs.length === 1 ? 'pair' : 'pairs'} (${label(first[0])} over ${label(first[1])}${pairs.length > 1 ? ', and more' : ''})`,
    );
  }
  if (clipped.length > 0) parts.push(`${clipped.length} clipped text ${clipped.length === 1 ? 'element' : 'elements'}`);
  const viewport = { x: 0, y: 0, w: dom.viewport.width, h: dom.viewport.height };
  const where = pairs[0]?.[2] ?? clipped[0]?.box ?? facts0.beyondViewport[0]?.box ?? viewport;
  const base: Facts = { measurements, captureCrop: roundRect(where) };
  if (parts.length === 0) return done({ status: 'pass', confidence: 'high', facts: base });
  return done({
    status: 'fail',
    confidence: 'high',
    severity: 'major',
    statement: `The page does not fit its viewport: ${parts.join('; ')}, measured from DOM snapshot.`,
    fix: `Remove the horizontal overflow, separate the overlapping elements and stop clipping text at ${dom.viewport.width} px.`,
    facts: { ...base, ...(pairs[0] && { selector: pairs[0][0].selector }) },
  });
};

const visible: Handler<'visible'> = async (req, v) => {
  if (!v.dom) return done({ status: 'not-checked', reason: 'no-dom-snapshot', confidence: 'low', facts: NO_FACTS });
  const found = await find(v, req.check.match, regionOn(req, v), true);
  const ok = found.find((e) => e.visible && !e.flags.beyondViewport);
  const shown = ok ?? found[0];
  const facts: Facts = {
    measurements: [],
    ...(shown && { selector: shown.selector, captureCrop: roundRect(shown.box) }),
    ...(resolvedRect(req) && { designCrop: roundRect(resolvedRect(req) as Rect) }),
  };
  if (ok) return done({ status: 'pass', confidence: 'high', facts });
  const why = found.length === 0 ? 'is not in the DOM snapshot' : 'is hidden or beyond the viewport';
  return done({
    status: 'fail',
    confidence: 'high',
    severity: 'major',
    statement: `${req.statement}: the element ${why}, measured from DOM snapshot.`,
    fix: 'Keep the element rendered, visible and inside the viewport width.',
    facts,
  });
};

// ---- region-diff, position, judged -----------------------------------------------------------------------------

const regionDiffHandler: Handler<'region-diff'> = async (req, v) => {
  const gate = await imageGate(req, v);
  if ('stop' in gate) return gate.stop;
  const { region, design, capture } = gate.images;
  const located = await v.m.locateOnCapture(design, region, capture, v.t);
  if (located.score < 0.5) return regionIssue(req, 'the region could not be located on the capture');
  const { diffRatio } = await v.m.regionDiff(design, region, capture, located.rect, v.t);
  const pctValue = round1(diffRatio * 100);
  const facts: Facts = {
    measurements: [
      {
        name: 'Changed pixels',
        design: 0,
        observed: pctValue,
        unit: '%',
        delta: pctValue,
        source: { design: 'design-image', observed: 'capture-image' },
      },
    ],
    designCrop: roundRect(region),
    captureCrop: roundRect(located.rect),
    diffRatio,
  };
  if (diffRatio <= v.t.visual_diff_ratio) return done({ status: 'pass', confidence: 'medium', facts });
  return done({
    status: 'fail',
    confidence: 'medium',
    severity: diffRatio >= 2 * v.t.visual_diff_ratio ? 'major' : 'minor',
    statement: `${pctValue}% of the pixels in this region differ from the design (limit ${round1(v.t.visual_diff_ratio * 100)}%), measured from images.`,
    fix: 'Match this region to the design; the highlighted pixels differ.',
    facts,
  });
};

const judged = async (req: Requirement): Promise<HandlerResult> => judgeNeed(req, { cap: 'high', strict: true });

/** The registry (SPEC-ARCH-08): a new check kind is one new entry here and one CheckSpec variant in the kernel. */
export const HANDLERS: { [K in Kind]: Handler<K> } = {
  presence,
  count,
  text,
  size,
  position: judged,
  spacing,
  'dominant-text': dominantText,
  colour,
  'layout-fits': layoutFits,
  visible,
  'region-diff': regionDiffHandler,
  judged,
};

export async function runHandler(req: Requirement, v: ViewportCtx): Promise<HandlerResult> {
  if (req.checkType === 'judged') return judgeNeed(req, { cap: 'high', strict: true });
  const handler = HANDLERS[req.check.kind] as (r: Requirement, c: ViewportCtx) => Promise<HandlerResult>;
  return handler(req, v);
}
