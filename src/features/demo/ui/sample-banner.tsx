import type { FC } from 'react';
import { Icon } from './icon';

/** "Sample results (pre-computed)" with an optional "Allow cloud to judge live" action (SPEC-DEMO-04, SPEC-DEMO-05). */
export interface SampleBannerProps {
  onAllowLive?(): void;
  /** Why the sample result is shown; defaults to the measured-checks line. */
  detail?: string;
}

export const SampleBanner: FC<SampleBannerProps> = ({ onAllowLive, detail }) => (
  <div className="notice notice-info" role="status">
    <Icon name="info" />
    <p className="title">Sample results (pre-computed)</p>
    <p className="small muted">{detail ?? 'Measured and visual checks ran live on this device.'}</p>
    {onAllowLive && (
      <div className="btn-row">
        <button className="btn" type="button" onClick={onAllowLive}>
          Allow cloud to judge live
        </button>
      </div>
    )}
  </div>
);
