import type { DomElement, DomSnapshot, ElementMatcher, Rect } from '@kernel';

// DOM facts (SPEC-MEAS-13, SPEC-MEAS-14): pure functions over a DomSnapshot; no clock, randomness or locale (SPEC-MEAS-16).

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

function ancestors(dom: DomSnapshot, e: DomElement): DomElement[] {
  const byIndex = new Map(dom.elements.map((x) => [x.i, x]));
  const out: DomElement[] = [];
  const seen = new Set<number>([e.i]);
  let p = e.parent === null ? undefined : byIndex.get(e.parent);
  while (p && !seen.has(p.i)) {
    out.push(p);
    seen.add(p.i);
    p = p.parent === null ? undefined : byIndex.get(p.parent);
  }
  return out;
}

function matches(dom: DomSnapshot, e: DomElement, m: ElementMatcher): boolean {
  if (m.selector !== undefined && e.selector !== m.selector) return false;
  if (m.tag !== undefined && e.tag !== m.tag) return false;
  if (m.role !== undefined && e.role !== m.role) return false;
  if (m.text !== undefined && !collapse(e.text ?? '').includes(collapse(m.text))) return false;
  if (m.within !== undefined) {
    const within = m.within;
    if (!ancestors(dom, e).some((a) => matches(dom, a, within))) return false;
  }
  return true;
}

/** SPEC-MEAS-14. `region` is in the capture's CSS pixels (the caller scales design regions first). */
export function matchElements(dom: DomSnapshot, m: ElementMatcher, region?: Rect): DomElement[] {
  const found = dom.elements
    .filter((e) => matches(dom, e, m))
    .filter((e) => {
      if (!region) return true;
      const cx = e.box.x + e.box.w / 2;
      const cy = e.box.y + e.box.h / 2;
      return cx >= region.x && cx < region.x + region.w && cy >= region.y && cy < region.y + region.h;
    })
    .sort((a, b) => a.i - b.i);
  if (m.nth === undefined) return found;
  const one = Number.isInteger(m.nth) && m.nth >= 0 ? found[m.nth] : undefined;
  return one ? [one] : [];
}

/** SPEC-MEAS-13. */
export function overflowFacts(dom: DomSnapshot): {
  horizontalPx: number;
  beyondViewport: DomElement[];
  clipped: DomElement[];
} {
  return {
    horizontalPx: Math.max(0, dom.document.scrollWidth - dom.document.clientWidth),
    beyondViewport: dom.elements.filter((e) => e.flags.beyondViewport),
    clipped: dom.elements.filter((e) => e.flags.clippedByAncestor || e.flags.textClipped),
  };
}

const OVERLAP_KINDS = new Set<DomElement['kind']>(['landmark', 'heading', 'button', 'link', 'image']);
const MIN_OVERLAP_AREA = 16;
const MIN_OVERLAP_FRACTION = 0.1;

/** SPEC-MEAS-13: [a, b, intersection] with a before b in document order. */
export function overlaps(dom: DomSnapshot): [DomElement, DomElement, Rect][] {
  const els = dom.elements.filter((e) => e.visible && OVERLAP_KINDS.has(e.kind)).sort((a, b) => a.i - b.i);
  const chains = new Map(els.map((e) => [e.i, new Set(ancestors(dom, e).map((a) => a.i))]));
  const out: [DomElement, DomElement, Rect][] = [];
  for (let m = 0; m < els.length; m++) {
    for (let n = m + 1; n < els.length; n++) {
      const a = els[m] as DomElement;
      const b = els[n] as DomElement;
      if (chains.get(a.i)?.has(b.i) || chains.get(b.i)?.has(a.i)) continue;
      const x = Math.max(a.box.x, b.box.x);
      const y = Math.max(a.box.y, b.box.y);
      const w = Math.min(a.box.x + a.box.w, b.box.x + b.box.w) - x;
      const h = Math.min(a.box.y + a.box.h, b.box.y + b.box.h) - y;
      if (w <= 0 || h <= 0) continue;
      const area = w * h;
      const smaller = Math.min(a.box.w * a.box.h, b.box.w * b.box.h);
      if (area < MIN_OVERLAP_AREA || area < MIN_OVERLAP_FRACTION * smaller) continue;
      out.push([a, b, { x, y, w, h }]);
    }
  }
  return out;
}
