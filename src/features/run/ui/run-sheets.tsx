import { type FC, useId, useRef, useState } from 'react';
import { Icon } from './icon';
import { Sheet } from './sheet';

export type ExportFormat = 'md' | 'json';
export type ExportAction = 'copy' | 'download';

/** The fix prompt, read-only, to check before pasting it into the coding agent (PRD-F-08). */
export const FixPromptSheet: FC<{ text: string; onCopy(): void; onClose(): void }> = ({ text, onCopy, onClose }) => {
  const id = useId();
  const close = useRef<HTMLButtonElement>(null);
  return (
    <Sheet labelledBy={`${id}-h`} onClose={onClose} initialFocus={close}>
      <div className="sheet-head">
        <div className="stack-sm">
          <h2 id={`${id}-h`}>Fix prompt</h2>
          <p className="muted small">Paste it into your coding agent.</p>
        </div>
        <button className="iconbtn" type="button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="field">
        <label htmlFor={`${id}-t`}>Prompt text</label>
        <textarea className="textarea code" id={`${id}-t`} rows={14} readOnly value={text} />
      </div>
      <div className="sheet-foot">
        <button className="btn" type="button" ref={close} onClick={onClose}>
          Close
        </button>
        <button className="btn btn-primary" type="button" onClick={onCopy}>
          <Icon name="copy" small />
          Copy fix prompt
        </button>
      </div>
    </Sheet>
  );
};

/** Format choice for the report; the exporter itself lives in `app` (SPEC §4.10). */
export const ExportSheet: FC<{ onExport(format: ExportFormat, action: ExportAction): void; onClose(): void }> = ({
  onExport,
  onClose,
}) => {
  const id = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  const [format, setFormat] = useState<ExportFormat>('md');
  const go = (action: ExportAction) => {
    onExport(format, action);
    onClose();
  };
  return (
    <Sheet labelledBy={`${id}-h`} onClose={onClose} initialFocus={cancel}>
      <div className="sheet-head">
        <h2 id={`${id}-h`}>Export report</h2>
        <button className="iconbtn" type="button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <fieldset className="stack-sm">
        <legend>Format</legend>
        <label className="choice">
          <input type="radio" name={`${id}-fmt`} checked={format === 'md'} onChange={() => setFormat('md')} />
          <span>Markdown</span>
          <span className="help">For people: a hand-over report with every finding, its measurements and engine.</span>
        </label>
        <label className="choice">
          <input type="radio" name={`${id}-fmt`} checked={format === 'json'} onChange={() => setFormat('json')} />
          <span>JSON</span>
          <span className="help">
            For tools: <span className="mono">conformui.report</span> version 1. Crops are referenced as rectangles, not
            embedded.
          </span>
        </label>
      </fieldset>
      <p className="small muted">Includes the engine and source of every item. No images or snapshot text.</p>
      <div className="sheet-foot">
        <button className="btn" type="button" ref={cancel} onClick={onClose}>
          Cancel
        </button>
        <button className="btn" type="button" onClick={() => go('copy')}>
          Copy
        </button>
        <button className="btn btn-primary" type="button" onClick={() => go('download')}>
          <Icon name="download" small />
          Download
        </button>
      </div>
    </Sheet>
  );
};
