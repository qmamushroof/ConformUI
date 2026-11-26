import type { FC } from 'react';
import { Icon } from './icon';

/** One click to the sample Project (SPEC-DEMO-02). */
export interface TrySampleButtonProps {
  onTry(): void;
  busy?: boolean;
}

export const TrySampleButton: FC<TrySampleButtonProps> = ({ onTry, busy }) => (
  <button className="btn btn-primary" type="button" aria-busy={busy || undefined} disabled={busy} onClick={onTry}>
    <Icon name="play" small />
    Try the sample
  </button>
);
