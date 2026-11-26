import {
  type CheckSpec,
  type ElementMatcher,
  MAX_REQUIREMENTS,
  type Requirement,
  VIEWPORT_PREFIX,
  VIEWPORT_PRESETS,
  type ViewportId,
} from '@kernel';

// Rule-based Inferred requirements (SPEC-CON-04, S8, S24). Generated only by ContractService, never by a Run.

const P0: ViewportId[] = ['desktop', 'mobile'];
const NAME: Record<ViewportId, string> = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' };

const matcherOf = (check: CheckSpec): ElementMatcher => ('match' in check ? check.match : {});

/** Design viewport closest in width to `target`; undefined without any design. */
function nearest(target: ViewportId, designed: ViewportId[]): ViewportId | undefined {
  const gap = (v: ViewportId) => Math.abs(VIEWPORT_PRESETS[v] - VIEWPORT_PRESETS[target]);
  return [...designed].sort((a, b) => gap(a) - gap(b))[0];
}

/**
 * New Inferred items for every P0 viewport that has no design and no Inferred item yet.
 * Ids are `I-<D|M>-nn`, unique in the Contract; capped so the Contract stays within MAX_REQUIREMENTS.
 */
export function inferredFor(reqs: Requirement[], designed: ViewportId[]): Requirement[] {
  const out: Requirement[] = [];
  const used = new Set(reqs.map((r) => r.id));
  for (const viewport of P0) {
    if (designed.includes(viewport)) continue;
    if (reqs.some((r) => r.label === 'inferred' && r.viewport === viewport)) continue;
    const name = NAME[viewport];
    const prefix = `I-${VIEWPORT_PREFIX[viewport]}-`;
    let n = 0;
    const nextId = () => {
      let id: string;
      do id = `${prefix}${String(++n).padStart(2, '0')}`;
      while (used.has(id));
      used.add(id);
      return id;
    };
    const base = { viewport, label: 'inferred', accepted: false, origin: 'rule' } as const;
    out.push({
      ...base,
      id: nextId(),
      category: 'responsive',
      checkType: 'measured',
      statement: `Expected on ${name} (inferred): layout fits, with no horizontal scroll, overlap or clipped text`,
      condition: `At the ${name} viewport width there is no horizontal overflow, no overlapping elements and no clipped text`,
      check: { kind: 'layout-fits' },
    });
    const from = nearest(viewport, designed);
    for (const r of reqs) {
      if (r.label !== 'explicit' || !r.primary || r.viewport !== from) continue;
      out.push({
        ...base,
        id: nextId(),
        category: 'responsive',
        checkType: 'measured',
        statement: `Expected on ${name} (inferred): primary action stays visible`,
        condition: `The primary action from the ${NAME[r.viewport]} design is visible at the ${name} viewport width`,
        check: { kind: 'visible', match: matcherOf(r.check) },
        derivedFrom: r.id,
      });
    }
  }
  return out.slice(0, Math.max(0, MAX_REQUIREMENTS - reqs.length));
}
