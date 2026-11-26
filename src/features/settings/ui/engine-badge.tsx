import type { Engine, Origin } from '@kernel';
import type { FC } from 'react';
import { Icon, type IconName } from './icon';

/** Text label, icon and aria-label from the inference source (SPEC-SET-09). */
export interface EngineBadgeProps {
  engine: Engine;
  origin?: Origin;
}

const ENGINE: Record<Engine, { icon: IconName; text: string; aria: string }> = {
  'on-device': { icon: 'chip', text: 'On-device', aria: 'Produced by on-device model' },
  cloud: { icon: 'cloud', text: 'Cloud', aria: 'Produced by cloud model' },
  measured: { icon: 'ruler', text: 'Measured', aria: 'Produced by measurement' },
};

// Origins that are not an engine of their own (SPEC-SET-09).
const ORIGIN: Partial<Record<Origin, { icon: IconName; text: string; aria: string }>> = {
  rule: { icon: 'ruler', text: 'Rule (Measured)', aria: 'Rule (Measured)' },
  precomputed: { icon: 'file', text: 'Pre-computed', aria: 'Pre-computed' },
  sample: { icon: 'file', text: 'Sample (verified)', aria: 'Sample (verified)' },
  user: { icon: 'edit', text: 'Added by you', aria: 'Added by you' },
};

export const EngineBadge: FC<EngineBadgeProps> = ({ engine, origin }) => {
  const b = (origin ? ORIGIN[origin] : undefined) ?? ENGINE[engine];
  return (
    <span className="eng" role="img" aria-label={b.aria}>
      <Icon name={b.icon} />
      {b.text}
    </span>
  );
};
