import type { Change, Finding, Label, ViewportId } from '@kernel';
import { type FC, type KeyboardEvent, useId } from 'react';
import { Icon, type IconName } from './icon';
import { CHANGE_TEXT, rowDelta, SEVERITY_TEXT, VP_NAME } from './labels';
import { EngineText } from './status';

/** A Requirement that failed in the baseline Run and passes now (SPEC-RUN-10): listed after the Findings. */
export interface ResolvedItem {
  id: string;
  requirementId: string;
  viewport: ViewportId;
  title: string;
  label: Label;
}

export interface FindingListProps {
  /** Already sorted (`RunService.findings`, SPEC-RUN-08). */
  findings: readonly Finding[];
  /** Resolved rows of a Re-verify Run, shown after the Findings. */
  resolved?: readonly ResolvedItem[];
  /** `Run.changes`, keyed `reqId:viewport`; labels a row Remaining, New or Regressed. */
  changes?: Record<string, Change>;
  selectedId?: string;
  onSelect(findingId: string): void;
  /** Enter or click: the parent moves focus to the detail on narrow screens. */
  onActivate?(findingId: string): void;
}

interface Row {
  id: string;
  viewport: ViewportId;
  label: Label;
  title: string;
  icon: IconName;
  word: string;
  delta: string;
  fail: boolean;
  finding?: Finding;
}

function toRows(
  findings: readonly Finding[],
  resolved: readonly ResolvedItem[],
  changes: Record<string, Change> | undefined,
): Row[] {
  const rows: Row[] = findings.map((f) => {
    const change = changes?.[`${f.requirementId}:${f.viewport}`];
    const review = f.status === 'needs-review';
    const word =
      change && change !== 'resolved' && change !== 'still-passing'
        ? CHANGE_TEXT[change]
        : review
          ? 'Needs review'
          : SEVERITY_TEXT[f.severity];
    return {
      id: f.id,
      viewport: f.viewport,
      label: f.label,
      title: f.statement,
      icon: review ? 'review' : f.severity,
      word,
      delta: review ? '' : rowDelta(f),
      fail: !review,
      finding: f,
    };
  });
  for (const r of resolved) {
    rows.push({
      id: r.id,
      viewport: r.viewport,
      label: r.label,
      title: r.title,
      icon: 'up',
      word: CHANGE_TEXT.resolved,
      delta: '',
      fail: false,
    });
  }
  return rows;
}

/** Sorted Findings as a `listbox` with `aria-activedescendant`: Up/Down/Home/End select, Enter opens (SPEC-UI-06). */
export const FindingList: FC<FindingListProps> = ({
  findings,
  resolved = [],
  changes,
  selectedId,
  onSelect,
  onActivate,
}) => {
  const uid = useId();
  const rows = toRows(findings, resolved, changes);
  if (rows.length === 0) return <p className="muted small">No findings.</p>;

  const index = rows.findIndex((r) => r.id === selectedId);
  const optionId = (i: number) => `${uid}-o-${i}`;

  const move = (to: number) => {
    const next = rows[to];
    if (next && to !== index) onSelect(next.id);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(index < 0 ? 0 : Math.min(rows.length - 1, index + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(index < 0 ? 0 : Math.max(0, index - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      move(rows.length - 1);
    } else if (e.key === 'Enter') {
      const cur = rows[index];
      if (cur) {
        e.preventDefault();
        onActivate?.(cur.id);
      }
    }
  };

  return (
    <ul
      className="rows"
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a listbox with aria-activedescendant (SPEC-UI-06)
      role="listbox"
      aria-label="Findings, sorted by severity"
      tabIndex={0}
      aria-activedescendant={index >= 0 ? optionId(index) : undefined}
      onKeyDown={onKeyDown}
    >
      {rows.map((r, i) => (
        // biome-ignore lint/a11y/useFocusableInteractive: focus stays on the listbox (aria-activedescendant)
        // biome-ignore lint/a11y/useKeyWithClickEvents: the listbox handles the keys
        <li
          key={r.id}
          id={optionId(i)}
          // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: option of the listbox above
          role="option"
          aria-selected={i === index}
          className={`rowi${r.icon === 'review' ? ' is-review' : ''}`}
          onClick={() => {
            onSelect(r.id);
            onActivate?.(r.id);
          }}
        >
          <span className="ic" aria-hidden="true">
            <Icon name={r.icon} />
          </span>
          <span className="t">{r.title}</span>
          {r.delta ? <span className={`d${r.fail ? ' st-fail' : ''}`}>{r.delta}</span> : <span className="d" />}
          <span className="meta">
            <span>{r.word}</span>
            <span>{VP_NAME[r.viewport]}</span>
            {r.label === 'inferred' && (
              <span>
                <span className="tag tag-dashed">Inferred</span>
              </span>
            )}
            {r.finding && <EngineText engine={r.finding.engine} origin={r.finding.origin} />}
          </span>
        </li>
      ))}
    </ul>
  );
};
