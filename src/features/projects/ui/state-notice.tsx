import type { FC, ReactNode } from 'react';

/** Copy for one state (SPEC-UI-05); the table lives in `app/copy.ts` and is passed in, so features never import `app`. */
export interface NoticeCopy {
  tone: 'danger' | 'info' | 'neutral';
  title: string;
  detail?: string;
  /** Label of the single action button; shown only when `onAction` is given. */
  action?: string;
}

export interface StateNoticeProps {
  notice: NoticeCopy;
  /** `ErrorCode` or reason, shown as "Code X" so it can be reported. */
  code?: string;
  /** Render the title as the route's one `h1` (SPEC-UI-06). */
  heading?: boolean;
  onAction?(): void;
  /** Extra content under the detail, for example the list of snapshot problems. */
  children?: ReactNode;
}

// Paths from the prototype icon sprite (alert, info); drawn with the `.i` stroke style.
const PATHS = {
  alert: 'M12 3l10 18H2zM12 10v5M12 17.5v.5',
  info: 'M12 11v6M12 7.5v.5',
} as const;

/** One notice for every empty, error and degraded state (SPEC-UI-05). Danger is announced as an alert, the rest as status. */
export const StateNotice: FC<StateNoticeProps> = ({ notice, code, heading, onAction, children }) => {
  const danger = notice.tone === 'danger';
  const cls = `notice${notice.tone === 'neutral' ? '' : ` notice-${notice.tone}`}`;
  const Title = heading ? 'h1' : 'p';
  return (
    <div className={cls} role={danger ? 'alert' : 'status'}>
      <svg className="i" aria-hidden="true" viewBox="0 0 24 24">
        {danger ? <path d={PATHS.alert} /> : <circle cx="12" cy="12" r="9" />}
        {danger ? null : <path d={PATHS.info} />}
      </svg>
      <Title className="title">{notice.title}</Title>
      {notice.detail ? <p className="small muted">{notice.detail}</p> : null}
      {children}
      {code ? (
        <p className="xs muted">
          Code <span className="mono">{code}</span>
        </p>
      ) : null}
      {onAction && notice.action ? (
        <div className="btn-row">
          <button className="btn" type="button" onClick={onAction}>
            {notice.action}
          </button>
        </div>
      ) : null}
    </div>
  );
};
