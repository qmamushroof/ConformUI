import type { TraceStep } from '@kernel';
import { type CSSProperties, type FC, useId } from 'react';
import { Icon } from './icon';
import { durationText, plural, stepLabel } from './labels';

/** Progress of a Run in flight, built from the `RunEvent` stages the app collected (PRD-F-04.4, SPEC-RUN-01). */
export interface RunProgressProps {
  /** Requirements being checked ("Checking N requirements"). */
  total: number;
  /** Finished stages, in order (`RunEvent` `stage`). */
  steps: readonly TraceStep[];
  /** Label of the stage running now. */
  current?: string;
  /** Labels of the stages not started. */
  waiting?: readonly string[];
  /** A `needs-consent` event is open: the Run waits for the Consent sheet. */
  waitingConsent?: boolean;
  onStop?(): void;
}

/** Per-stage list with a `progressbar` (SPEC-UI-06). Measured and visual stages say nothing is sent. */
export const RunProgress: FC<RunProgressProps> = ({ total, steps, current, waiting = [], waitingConsent, onStop }) => {
  const headId = useId();
  const all = steps.length + (current ? 1 : 0) + waiting.length;
  const percent = all === 0 ? 0 : Math.round((steps.length / all) * 100);
  return (
    <section className="running" aria-labelledby={headId}>
      <div className="stack">
        <h2 id={headId} className="h3">
          Checking {plural(Math.max(0, total), 'requirement', 'requirements')}
        </h2>
        <div
          className="bar"
          role="progressbar"
          aria-label="Run progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ '--p': `${percent}%` } as CSSProperties} />
        </div>
        <ol className="stages">
          {steps.map((s, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stages repeat names and only append
            <li key={`${s.step}-${i}`}>
              <Icon name="check" small className="st-pass" />
              <span>{stepLabel(s.step)}</span>
              <span className="w small">{durationText(s.durationMs)}</span>
            </li>
          ))}
          {current && (
            <li>
              <span className="spinner" aria-hidden="true" />
              <span>{current}</span>
              <span className="w small">Running</span>
            </li>
          )}
          {waiting.map((w) => (
            <li key={w}>
              <Icon name="dash" small className="subtle" />
              <span className="muted">{w}</span>
              <span className="w small">Waiting</span>
            </li>
          ))}
        </ol>
        {waitingConsent && (
          <p className="small" role="status">
            Waiting for your choice on sending data to the cloud. Nothing is sent until you allow it.
          </p>
        )}
        <p className="small muted">Measured and visual checks run on this device. Nothing is sent.</p>
        {onStop && (
          <div className="btn-row">
            <button type="button" className="btn" onClick={onStop}>
              Stop
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
