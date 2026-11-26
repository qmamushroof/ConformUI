import type { FC } from 'react';

// Paths from the prototype icon sprite, drawn with the `.i` stroke style (SPEC-UI-04).
const PATHS = {
  plus: 'M12 5v14M5 12h14',
  play: 'M7 4l13 8-13 8z',
  upload: 'M12 16V5M7 10l5-5 5 5M4 20h16',
  image: 'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  desktop: 'M3 4h18v12H3zM8 20h8M12 16v4',
  phone: 'M7 2h10v20H7zM11 18h2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  dash: 'M7 12h10',
  review: 'M9.8 9.6a2.3 2.3 0 1 1 3.4 2c-.8.4-1.2.9-1.2 1.8M12 16.2v.4',
  alert: 'M12 3l10 18H2zM12 10v5M12 17.5v.5',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  close: 'M6 6l12 12M18 6L6 18',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  chev: 'M9 6l6 6-6 6',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
} as const;

export type IconName = keyof typeof PATHS;

export const Icon: FC<{ name: IconName; small?: boolean; large?: boolean; className?: string }> = ({
  name,
  small,
  large,
  className,
}) => (
  <svg
    className={`i${small ? ' i-sm' : ''}${large ? ' i-lg' : ''}${className ? ` ${className}` : ''}`}
    aria-hidden="true"
    viewBox="0 0 24 24"
  >
    {name === 'review' ? <circle cx="12" cy="12" r="9" strokeDasharray="3 2.6" /> : null}
    <path d={PATHS[name]} />
  </svg>
);
