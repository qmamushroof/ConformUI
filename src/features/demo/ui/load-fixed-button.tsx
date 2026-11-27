import type { FC } from 'react';
import { Icon } from './icon';

/** Sample Projects only (SPEC-DEMO-04): replaces captures and snapshots with the fixed set; the user then clicks Re-verify. */
export interface LoadFixedButtonProps {
  onLoad(): void;
  busy?: boolean;
  /** Primary styling while it is the obvious next step. */
  primary?: boolean;
}

export const LoadFixedButton: FC<LoadFixedButtonProps> = ({ onLoad, busy, primary }) => (
  <button
    className={primary ? 'btn btn-primary' : 'btn'}
    type="button"
    aria-busy={busy || undefined}
    disabled={busy}
    onClick={onLoad}
  >
    <Icon name="refresh" small />
    Load fixed implementation
  </button>
);
