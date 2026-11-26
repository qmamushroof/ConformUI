import type { SendList } from '@kernel';
import { type FC, useId, useRef } from 'react';
import { Icon } from './icon';
import { Sheet } from './sheet';

/** Lists what is sent (SPEC-DEEP-02); `onSend` receives the click event so the caller mints consent from it. */
export interface DeepConfirmSheetProps {
  sends: SendList;
  /** The click's native event. The caller passes it to `mintConsent({scope:'deep'}, ev)`, which throws unless `isTrusted`. */
  onSend(ev: { isTrusted: boolean }): void;
  onCancel(): void;
  /** Number of findings the cloud refines ("Cloud refines the 1 finding that needs review"). */
  targetCount?: number;
  /** Model name, shown in the Model row. */
  model?: string;
  /** "Deep Analysis today: used of cap". */
  usage?: { used: number; cap: number };
  /** Total in bytes; defaults to the sum of the list. */
  totalBytes?: number;
}

const kb = (bytes: number) => `${bytes === 0 ? 0 : Math.max(1, Math.round(bytes / 1024))} KB`;
const utf8 = (s: string) => new TextEncoder().encode(s).length;

export const DeepConfirmSheet: FC<DeepConfirmSheetProps> = ({
  sends,
  onSend,
  onCancel,
  targetCount,
  model,
  usage,
  totalBytes,
}) => {
  const id = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  const total =
    totalBytes ?? sends.images.reduce((n, i) => n + i.bytes, 0) + sends.text.reduce((n, t) => n + utf8(t), 0);
  const refine =
    targetCount === undefined
      ? 'Cloud refines the findings that need review.'
      : `Cloud refines the ${targetCount} ${targetCount === 1 ? 'finding that needs' : 'findings that need'} review.`;
  return (
    <Sheet labelledBy={`${id}-h`} onClose={onCancel} initialFocus={cancel}>
      <div className="sheet-head">
        <div className="stack-sm">
          <h2 id={`${id}-h`}>Send this run for Deep Analysis?</h2>
          <p className="muted small">{refine} Exactly this is sent to Google Gemini through Firebase:</p>
        </div>
        <button className="iconbtn" type="button" aria-label="Close" onClick={onCancel}>
          <Icon name="close" />
        </button>
      </div>
      <ul className="sendlist">
        {sends.images.map((i) => (
          <li key={i.label}>
            <span>{i.label}</span>
            <span className="num">{kb(i.bytes)}</span>
          </li>
        ))}
        {sends.text.map((t) => (
          <li key={t}>
            <span>{t}</span>
            <span className="num">{kb(utf8(t))}</span>
          </li>
        ))}
        <li className="total">
          <span>Total</span>
          <span className="num">{kb(total)}</span>
        </li>
      </ul>
      {(model || usage) && (
        <dl className="kv">
          {model && (
            <>
              <dt>Model</dt>
              <dd className="mono">{model}</dd>
            </>
          )}
          {usage && (
            <>
              <dt>Deep Analysis today</dt>
              <dd>
                {usage.used} of {usage.cap} used
              </dd>
            </>
          )}
        </dl>
      )}
      <div className="sheet-foot">
        <button className="btn" type="button" ref={cancel} onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" type="button" onClick={(e) => onSend(e.nativeEvent)}>
          <Icon name="cloud" small />
          Send to cloud
        </button>
      </div>
    </Sheet>
  );
};
