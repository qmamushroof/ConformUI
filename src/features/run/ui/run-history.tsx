import type { RunSummary } from '@kernel';
import type { FC } from 'react';
import { Icon } from './icon';
import { dateText } from './labels';

export interface RunHistoryProps {
  /** Newest first (`RunService.history`, SPEC-RUN-11). */
  runs: readonly RunSummary[];
  currentRunId?: string;
  onOpen(runId: string): void;
}

function counts(r: RunSummary): string {
  const parts = [
    r.fail > 0 && `${r.fail} fail`,
    r.review > 0 && `${r.review} needs review`,
    r.pass > 0 && `${r.pass} pass`,
  ].filter((p): p is string => p !== false);
  return parts.length > 0 ? parts.join(', ') : 'Nothing checked';
}

/** Runs of a project with date, Contract version and counts (SPEC-RUN-11, PRD-F-07.3). */
export const RunHistory: FC<RunHistoryProps> = ({ runs, currentRunId, onOpen }) => {
  if (runs.length === 0) return <p className="muted small">No runs yet.</p>;
  return (
    <ul className="runs">
      {runs.map((r, i) => {
        const open = r.fail > 0 || r.review > 0;
        return (
          <li key={r.id}>
            <button
              type="button"
              className="rowi"
              aria-current={r.id === currentRunId ? 'true' : undefined}
              onClick={() => onOpen(r.id)}
            >
              <span className="ic" aria-hidden="true">
                <Icon name={i === runs.length - 1 ? 'play' : 'refresh'} />
              </span>
              <span className="t">Run {runs.length - i}</span>
              <span className={`d st ${open ? 'st-fail' : 'st-pass'}`}>
                <Icon name={open ? 'x' : 'check'} />
                {open ? `${r.fail + r.review} fail` : 'Pass'}
              </span>
              <span className="meta">
                <span>{dateText(r.createdAt)}</span>
                <span>{counts(r)}</span>
                <span>Contract v{r.contractVersion}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
