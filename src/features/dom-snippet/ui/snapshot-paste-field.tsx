import type { DomSnapshot, ViewportId } from '@kernel';
import { type FC, useId, useState } from 'react';
import { parseSnapshot } from '../parse-snapshot';
import { Icon } from './icon';

/** Paste field for one DOM snapshot (SPEC-SNIP-08, PRD-F-13.5, PRD-F-13.6). Shown in the project's snapshot sheet. */
export interface SnapshotPasteFieldProps {
  viewport: ViewportId;
  cssWidth: number;
  onAccept(s: DomSnapshot): void;
  onCancel?(): void;
}

const LABELS: Record<ViewportId, string> = { desktop: 'Desktop 1440', mobile: 'Mobile 390', tablet: 'Tablet 768' };

type Feedback = { kind: 'error' | 'warn'; title: string; list: string[]; foot: string };

const errorFeedback = (errors: string[]): Feedback => {
  const list = errors.map((e) =>
    e === 'SNAPSHOT_TOO_LARGE' ? 'Larger than 1 MB. Run the snippet again; it trims long text automatically.' : e,
  );
  const n = list.length;
  return {
    kind: 'error',
    title: `This snapshot can't be used: ${n} ${n === 1 ? 'problem' : 'problems'}.`,
    list,
    foot: 'The run will use images only.',
  };
};

export const SnapshotPasteField: FC<SnapshotPasteFieldProps> = ({ viewport, cssWidth, onAccept, onCancel }) => {
  const id = useId();
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<Feedback>();
  const [warned, setWarned] = useState(false);

  const edit = (v: string) => {
    setText(v);
    setFeedback(undefined);
    setWarned(false);
  };

  const add = () => {
    if (!text.trim()) {
      setFeedback(errorFeedback(['Nothing pasted. Run the snippet, then paste here.']));
      return;
    }
    const r = parseSnapshot(text, { cssWidth });
    if (!r.ok) {
      setFeedback(errorFeedback(r.errors));
      return;
    }
    if (r.warnings.includes('dom-viewport-mismatch') && !warned) {
      setWarned(true);
      setFeedback({
        kind: 'warn',
        title: 'Check the viewport.',
        list: [
          `The snapshot was taken at ${r.snapshot.viewport.width} px; the ${LABELS[viewport]} capture is ${cssWidth} px wide.`,
        ],
        foot: 'Measurements are only exact when the widths match.',
      });
      return;
    }
    onAccept(r.snapshot);
  };

  const invalid = feedback?.kind === 'error';
  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-text`}>Snapshot JSON</label>
        <textarea
          className="textarea code"
          id={`${id}-text`}
          rows={9}
          spellCheck={false}
          value={text}
          placeholder='{"schema":"conformui.dom-snapshot","version":1,...}'
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={`${id}-help ${id}-errs`}
          onChange={(e) => edit(e.target.value)}
        />
        <p className="help" id={`${id}-help`}>
          Up to 1 MB. Invalid snapshots are not stored.
        </p>
        <div id={`${id}-errs`} className="stack-sm" hidden={!feedback} role={invalid ? 'alert' : 'status'}>
          {feedback ? (
            <>
              <p className="error">
                <Icon name="alert" small />
                <span>{feedback.title}</span>
              </p>
              <ul className="problems" aria-label="Problems">
                {feedback.list.slice(0, 5).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <p className="small muted">{feedback.foot}</p>
            </>
          ) : null}
        </div>
      </div>
      <div className="sheet-foot">
        {onCancel ? (
          <button className="btn" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button className="btn btn-primary" type="button" onClick={add}>
          {feedback?.kind === 'warn' ? 'Use anyway' : 'Add snapshot'}
        </button>
      </div>
    </>
  );
};
