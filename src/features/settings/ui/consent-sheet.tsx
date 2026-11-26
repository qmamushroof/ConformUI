import type { SendList } from '@kernel';
import { type FC, useId, useRef } from 'react';
import { Icon } from './icon';
import { Sheet } from './sheet';

/** Project cloud consent sheet (PRD-H-05); reused by contract and run screens through `app`. */
export interface ConsentSheetProps {
  sends: SendList;
  /** Receives the click event so the caller can check `isTrusted` (SPEC-DEEP-01). */
  onAllow(ev: { isTrusted: boolean }): void;
  onDecline(): void;
  projectName?: string;
  /** Why the cloud is needed, shown before the list. */
  reason?: string;
}

const kb = (bytes: number) => `${bytes === 0 ? 0 : Math.max(1, Math.round(bytes / 1024))} KB`;
const utf8 = (s: string) => new TextEncoder().encode(s).length;

export const ConsentSheet: FC<ConsentSheetProps> = ({ sends, onAllow, onDecline, projectName, reason }) => {
  const id = useId();
  const decline = useRef<HTMLButtonElement>(null);
  const total = sends.images.reduce((n, i) => n + i.bytes, 0) + sends.text.reduce((n, t) => n + utf8(t), 0);
  return (
    <Sheet labelledBy={`${id}-h`} onClose={onDecline} initialFocus={decline}>
      <div className="sheet-head">
        <div className="stack-sm">
          <h2 id={`${id}-h`}>Allow cloud for this project?</h2>
          <p className="muted small">
            {reason ? `${reason} ` : ''}ConformUI sends exactly this to Google Gemini through Firebase:
          </p>
        </div>
        <button className="iconbtn" type="button" aria-label="Close" onClick={onDecline}>
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
      <p className="small muted">
        {projectName ? `Applies to ${projectName} only. ` : ''}Revoke any time in{' '}
        <a href="/settings#consent">Settings</a>. If you decline, nothing is sent: you can add requirements by hand.
      </p>
      <div className="sheet-foot">
        <button className="btn" type="button" ref={decline} onClick={onDecline}>
          Decline
        </button>
        <button className="btn btn-primary" type="button" onClick={(e) => onAllow(e.nativeEvent)}>
          <Icon name="cloud" small />
          Allow for this project
        </button>
      </div>
    </Sheet>
  );
};
