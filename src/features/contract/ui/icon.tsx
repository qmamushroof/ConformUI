import type { FC } from 'react';

// Paths from the prototype icon sprite, drawn with the `.i` stroke style (SPEC-UI-04).
const PATHS = {
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  cloud: 'M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 18z',
  ruler: 'M2 8h20v8H2zM6 8v3M10 8v4M14 8v3M18 8v4',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  dash: 'M7 12h10',
  review: 'M9.8 9.6a2.3 2.3 0 1 1 3.4 2c-.8.4-1.2.9-1.2 1.8M12 16.2v.4',
  plus: 'M12 5v14M5 12h14',
  more: '',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  chev: 'M9 6l6 6-6 6',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 11v6M12 7.5v.5',
  alert: 'M12 3l10 18H2zM12 10v5M12 17.5v.5',
  upload: 'M12 16V5M7 10l5-5 5 5M4 20h16',
  close: 'M6 6l12 12M18 6L6 18',
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

export type IconName = keyof typeof PATHS;

export const Icon: FC<{ name: IconName; small?: boolean; className?: string }> = ({ name, small, className }) => (
  <svg
    className={`${small ? 'i i-sm' : 'i'}${className ? ` ${className}` : ''}`}
    aria-hidden="true"
    viewBox="0 0 24 24"
  >
    <Shapes name={name} />
    <path d={PATHS[name]} />
  </svg>
);
