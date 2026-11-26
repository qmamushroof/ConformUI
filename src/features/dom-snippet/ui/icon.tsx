import type { FC } from 'react';

// Paths from the prototype icon sprite, drawn with the `.i` stroke style (SPEC-UI-04).
const PATHS = {
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',
  alert: 'M12 3l10 18H2zM12 10v5M12 17.5v.5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  chev: 'M9 6l6 6-6 6',
} as const;

export const Icon: FC<{ name: keyof typeof PATHS; small?: boolean; className?: string }> = ({
  name,
  small,
  className,
}) => (
  <svg className={`i${small ? ' i-sm' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true" viewBox="0 0 24 24">
    <path d={PATHS[name]} />
  </svg>
);
