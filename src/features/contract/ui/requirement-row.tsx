import type { Category, CheckType, Requirement } from '@kernel';
import type { FC, ReactNode } from 'react';
import { rowFields } from '../display';
import { Icon } from './icon';

export const CATEGORY_TEXT: Record<Category, string> = {
  presence: 'Presence',
  content: 'Text',
  position: 'Alignment',
  size: 'Size',
  spacing: 'Spacing',
  typography: 'Typography',
  colour: 'Colour',
  responsive: 'Responsive',
};
export const CHECK_TEXT: Record<CheckType, string> = { measured: 'Measured', visual: 'Visual', judged: 'Judged' };

/** One row of the Requirement table (SPEC-CON-08). Label and status are text plus icon, never colour alone (PRD-P-12). */
export interface RequirementRowProps {
  requirement: Requirement;
  selected?: boolean;
  /** Engine badge (`EngineBadge` from settings, passed in by `app`); falls back to a text badge. */
  badge?: ReactNode;
  onSelect?(): void;
  onAccept?(): void;
  onReject?(): void;
  onEdit?(): void;
  onHighlight?(on: boolean): void;
}

export const RequirementRow: FC<RequirementRowProps> = ({ requirement: r, selected, badge, onSelect, onHighlight }) => {
  const f = rowFields(r);
  const unresolved = r.region !== undefined && 'unresolved' in r.region;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the listbox owns the keyboard (aria-activedescendant)
    <li
      id={`o-${r.id}`}
      className="rowi"
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: listbox option on li, as in the prototype
      role="option"
      aria-selected={selected === true}
      tabIndex={-1}
      data-id={r.id}
      onClick={onSelect}
      onMouseOver={() => onHighlight?.(true)}
      onMouseOut={() => onHighlight?.(false)}
      onFocus={() => onHighlight?.(true)}
      onBlur={() => onHighlight?.(false)}
    >
      <span className="ic" aria-hidden="true">
        {r.accepted ? <Icon name="check" /> : <Icon name="dash" className="subtle" />}
      </span>
      <span className="t">{r.statement}</span>
      <span className="d" />
      <span className="meta">
        <span className="mono">{r.id}</span>
        <span>{CATEGORY_TEXT[r.category]}</span>
        <span>{CHECK_TEXT[r.checkType]}</span>
        {f.label.advisory ? (
          <span>
            <span className="tag tag-dashed">Inferred</span>
          </span>
        ) : null}
        {badge ?? (
          <span className="eng">
            <Icon name="chip" />
            {f.badge}
          </span>
        )}
        {unresolved ? <span>Needs review: region not found</span> : r.accepted ? null : <span>Not reviewed</span>}
      </span>
    </li>
  );
};
