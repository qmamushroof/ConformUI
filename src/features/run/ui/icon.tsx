import type { FC } from 'react';

// Shapes from the prototype icon sprite, drawn with the `.i` stroke style (SPEC-UI-04).
const PATHS = {
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  cloud: 'M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 18z',
  ruler: 'M2 8h20v8H2zM6 8v3M10 8v4M14 8v3M18 8v4',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  dash: 'M7 12h10',
  review: 'M9.8 9.6a2.3 2.3 0 1 1 3.4 2c-.8.4-1.2.9-1.2 1.8M12 16.2v.4',
  plus: 'M12 5v14M5 12h14',
  play: 'M7 4l13 8-13 8z',
  more: '',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  chev: 'M9 6l6 6-6 6',
  x: 'M6 6l12 12M18 6L6 18',
  close: 'M6 6l12 12M18 6L6 18',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  alert: 'M12 3l10 18H2zM12 10v5M12 17.5v.5',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 11v6M12 7.5v.5',
  critical: 'M8 2h8l6 6v8l-6 6H8l-6-6V8z',
  major: 'M12 2.5l10.5 19h-21z',
  minor: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z',
} as const;

// Sprite shapes that are not plain paths: the dashed review ring, the three "more" dots and the image sun.
const Shapes: FC<{ name: string }> = ({ name }) => {
  if (name === 'review') return <circle cx="12" cy="12" r="9" strokeDasharray="3 2.6" />;
  if (name === 'more')
    return (
      <>
        <circle cx="5" cy="12" r="1.2" />
        <circle cx="12" cy="12" r="1.2" />
        <circle cx="19" cy="12" r="1.2" />
      </>
    );
  if (name === 'image') return <circle cx="15.5" cy="8.5" r="1.5" />;
  return null;
};

export type IconName = keyof typeof PATHS | 'layers';

const FILLED = new Set<IconName>(['critical', 'major']);

export const Icon: FC<{ name: IconName; small?: boolean; className?: string }> = ({ name, small, className }) => (
  <svg
    className={`${small ? 'i i-sm' : 'i'}${className ? ` ${className}` : ''}`}
    aria-hidden="true"
    viewBox="0 0 24 24"
  >
    <Shapes name={name} />
    {name === 'layers' ? (
      <>
        <rect x="3" y="3" width="12" height="12" />
        <rect x="9" y="9" width="12" height="12" strokeDasharray="3 2" />
      </>
    ) : FILLED.has(name) ? (
      <path fill="currentColor" stroke="none" d={PATHS[name as keyof typeof PATHS]} />
    ) : (
      <path d={PATHS[name as keyof typeof PATHS]} />
    )}
  </svg>
);
