import type { FC } from 'react';
import { Icon } from './icon';

/** "Nothing has left this device" or the request and byte totals (SPEC-SET-06). */
export interface PrivacyCounterProps {
  requests: number;
  bytes: number;
  /** `project` reads "this project" and has its own idle text. */
  scope?: 'project';
  /** Where a click goes (the engine trace list); a plain label without it. */
  href?: string;
}

const kb = (bytes: number) => String(Math.max(0.1, Math.round((bytes / 1024) * 10) / 10));

export function privacyText(requests: number, bytes: number, scope?: 'project'): string {
  if (requests === 0) {
    return scope === 'project' ? 'Nothing from this project has left this device' : 'Nothing has left this device';
  }
  const s = requests === 1 ? '' : 's';
  return `Cloud: ${requests} request${s} · ${kb(bytes)} KB${scope === 'project' ? ' this project' : ''}`;
}

export const PrivacyCounter: FC<PrivacyCounterProps> = ({ requests, bytes, scope, href }) => {
  const text = privacyText(requests, bytes, scope);
  const inner = (
    <>
      <Icon name="shield" small />
      <span className="lbl">{text}</span>
    </>
  );
  return href ? (
    <a className="status-link" href={href} aria-label={`Privacy: ${text}`}>
      {inner}
    </a>
  ) : (
    <span className="status-link" role="img" aria-label={`Privacy: ${text}`}>
      {inner}
    </span>
  );
};
