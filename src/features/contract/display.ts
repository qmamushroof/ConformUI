import type { Category, CheckType, Rect, Requirement, ViewportId } from '@kernel';

// Display data for the Contract screen (SPEC-CON-07, SPEC-CON-08, SPEC-UI-04). Pure; the UI renders it.

export const UNRESOLVED_REGION_NOTE = 'Region not found: image checks need review';

export type RegionDisplay =
  | { kind: 'outlined'; rect: Rect; dashed: false; source: 'snapped' | 'user' | 'sample' }
  | { kind: 'outlined'; rect: Rect; dashed: true; note: string }
  | { kind: 'none' };

export function regionDisplay(r: Requirement): RegionDisplay {
  const region = r.region;
  if (!region) return { kind: 'none' };
  if ('unresolved' in region) {
    return { kind: 'outlined', rect: region.suggested, dashed: true, note: UNRESOLVED_REGION_NOTE };
  }
  return { kind: 'outlined', rect: region.rect, dashed: false, source: region.source };
}

export interface RowFields {
  id: string;
  viewport: ViewportId;
  category: Category;
  label: { text: string; advisory: boolean };
  checkType: CheckType;
  checkKind: Requirement['check']['kind'];
  statement: string;
  condition: string;
  badge: string;
}

function badgeOf(r: Requirement): string {
  switch (r.origin) {
    case 'user':
      return 'Added by you';
    case 'rule':
      return 'Rule';
    case 'sample':
      return 'Sample (verified)';
    case 'precomputed':
      return 'Pre-computed';
    default:
      return r.engine === 'cloud' ? 'Cloud' : r.engine === 'on-device' ? 'On-device' : 'AI';
  }
}

export function rowFields(r: Requirement): RowFields {
  return {
    id: r.id,
    viewport: r.viewport,
    category: r.category,
    label:
      r.label === 'inferred' ? { text: 'Inferred (advisory)', advisory: true } : { text: 'Explicit', advisory: false },
    checkType: r.checkType,
    checkKind: r.check.kind,
    statement: r.statement,
    condition: r.condition,
    badge: badgeOf(r),
  };
}
