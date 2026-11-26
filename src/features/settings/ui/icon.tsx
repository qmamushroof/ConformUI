import type { FC } from 'react';

// Paths from the prototype icon sprite, drawn with the `.i` stroke style (SPEC-UI-04).
const PATHS = {
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  cloud: 'M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 18z',
  ruler: 'M2 8h20v8H2zM6 8v3M10 8v4M14 8v3M18 8v4',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  close: 'M6 6l12 12M18 6L6 18',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',
  play: 'M7 4l13 8-13 8z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
} as const;

export type IconName = keyof typeof PATHS;

export const Icon: FC<{ name: IconName; small?: boolean }> = ({ name, small }) => (
  <svg className={small ? 'i i-sm' : 'i'} aria-hidden="true" viewBox="0 0 24 24">
    <path d={PATHS[name]} />
  </svg>
);
