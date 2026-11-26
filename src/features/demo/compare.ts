import { iou, type Rect, type Requirement } from '@kernel';

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
