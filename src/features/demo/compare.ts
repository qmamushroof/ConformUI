import { aiDebug, iou, type Rect, type Requirement } from '@kernel';

const MIN_IOU = 0.5;

/** The rect used for matching: the resolved region, else the suggestion of an unresolved one. */
function rectOf(r: Requirement): Rect | undefined {
  if (!r.region) return undefined;
  return 'rect' in r.region ? r.region.rect : r.region.suggested;
}

/**
 * Same category, same viewport and region IoU >= 0.5 (SPEC-DEMO-03, PRD-M-14). One-to-one: each AI item takes the
 * best-overlapping verified item not yet taken. `matched` and `extra` hold AI ids, `missing` holds verified ids.
 */
export function compareWithVerified(
  ai: Requirement[],
  verified: Requirement[],
): { matched: string[]; missing: string[]; extra: string[] } {
  const taken = new Set<number>();
  const matched: string[] = [];
  const extra: string[] = [];
  for (const a of ai) {
    const ar = rectOf(a);
    let best = -1;
    let bestIou = 0;
    if (ar) {
      verified.forEach((v, i) => {
        const vr = rectOf(v);
        if (taken.has(i) || !vr || v.category !== a.category || v.viewport !== a.viewport) return;
        const score = iou(ar, vr);
        if (score >= MIN_IOU && score > bestIou) {
          best = i;
          bestIou = score;
        }
      });
    }
    if (best < 0) extra.push(a.id);
    else {
      taken.add(best);
      matched.push(a.id);
    }
  }
  const missing = verified.filter((_, i) => !taken.has(i)).map((v) => v.id);
  return { matched, missing, extra };
}

/**
 * Diagnostic only, never used to decide a match: how many verified items have some AI item overlapping at IoU >= 0.5 in
 * the same viewport whatever the category, so a person can tell a box problem from a category mismatch.
 */
export function overlapIgnoringCategory(ai: Requirement[], verified: Requirement[]): { verifiedWithOverlap: string[] } {
  const hit = verified.filter((v) => {
    const vr = rectOf(v);
    return (
      vr &&
      ai.some((a) => {
        const ar = rectOf(a);
        return ar && a.viewport === v.viewport && iou(ar, vr) >= MIN_IOU;
      })
    );
  });
  return { verifiedWithOverlap: hit.map((v) => v.id) };
}

export interface ComparedItem {
  id: string;
  statement: string;
}

/**
 * `compareWithVerified` with statements attached, each looked up in the list its id belongs to: `missing` ids are
 * verified ids, `extra` ids are AI ids, and the two lists can use the same ids (SPEC-DEMO-03).
 */
export function describeComparison(
  ai: Requirement[],
  verified: Requirement[],
): { matched: string[]; missing: ComparedItem[]; extra: ComparedItem[] } {
  const c = compareWithVerified(ai, verified);
  aiDebug('compare with verified contract', {
    matched: c.matched.length,
    missing: c.missing.length,
    extra: c.extra.length,
    verifiedWithAnyCategoryOverlap: overlapIgnoringCategory(ai, verified).verifiedWithOverlap,
    note: 'IoU >= 0.5, same viewport, any category; the match rule itself also needs the same category',
  });
  const item = (list: Requirement[]) => (id: string) => ({
    id,
    statement: list.find((r) => r.id === id)?.statement ?? '',
  });
  return { matched: c.matched, missing: c.missing.map(item(verified)), extra: c.extra.map(item(ai)) };
}
