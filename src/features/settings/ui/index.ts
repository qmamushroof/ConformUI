import type { Engine, EngineStatus, Origin, SendList, Settings } from '@kernel';
import type { FC } from 'react';

// UI components of this module (lane C). Re-exported by ../index.ts. Names are frozen at G0; Props interfaces are lane C's.

/** Routed screen `/settings` (SPEC §4.13.2): no props. */
export type SettingsScreenProps = Record<string, never>;
export const SettingsScreen: FC<SettingsScreenProps> = () => {
  throw new Error('not implemented');
};

/** Routed screen `/welcome` (SPEC-SET-08): no props. */
export type OnboardingScreenProps = Record<string, never>;
export const OnboardingScreen: FC<OnboardingScreenProps> = () => {
  throw new Error('not implemented');
};

export interface EnginePanelProps {
  status: EngineStatus;
  mode: Settings['mode'];
  onDownload(): void;
}
export const EnginePanel: FC<EnginePanelProps> = () => {
  throw new Error('not implemented');
};

/** Text label, icon and aria-label from the inference source (SPEC-SET-09). */
export interface EngineBadgeProps {
  engine: Engine;
  origin?: Origin;
}
export const EngineBadge: FC<EngineBadgeProps> = () => {
  throw new Error('not implemented');
};

/** "Nothing has left this device" or the request and byte totals (SPEC-SET-06). */
export interface PrivacyCounterProps {
  requests: number;
  bytes: number;
}
export const PrivacyCounter: FC<PrivacyCounterProps> = () => {
  throw new Error('not implemented');
};

/** Project cloud consent sheet (PRD-H-05); reused by contract and run screens through `app`. */
export interface ConsentSheetProps {
  sends: SendList;
  onAllow(ev: { isTrusted: boolean }): void;
  onDecline(): void;
}
export const ConsentSheet: FC<ConsentSheetProps> = () => {
  throw new Error('not implemented');
};
