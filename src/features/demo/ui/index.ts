import type { FC } from 'react';

// UI components of this module (lane C). Re-exported by ../index.ts. Names are frozen at G0; Props interfaces are lane C's.

export interface TrySampleButtonProps {
  onTry(): void;
  busy?: boolean;
}
export const TrySampleButton: FC<TrySampleButtonProps> = () => {
  throw new Error('not implemented');
};

/** "Sample results (pre-computed)" with an optional "Allow cloud to judge live" action (SPEC-DEMO-04). */
export interface SampleBannerProps {
  onAllowLive?(): void;
}
export const SampleBanner: FC<SampleBannerProps> = () => {
  throw new Error('not implemented');
};

export interface LoadFixedButtonProps {
  onLoad(): void;
  busy?: boolean;
}
export const LoadFixedButton: FC<LoadFixedButtonProps> = () => {
  throw new Error('not implemented');
};
