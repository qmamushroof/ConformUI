import { VIEWPORT_PRESETS, type ViewportId } from '@kernel';

const NAMES: Record<ViewportId, string> = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' };

/** "Desktop 1440" (SPEC §5.1). */
export const viewportLabel = (v: ViewportId): string => `${NAMES[v]} ${VIEWPORT_PRESETS[v]}`;
export const viewportName = (v: ViewportId): string => NAMES[v];

/** Release 1 offers Desktop and Mobile; Tablet is shown disabled (S9). */
export const RELEASE_VIEWPORTS: ViewportId[] = ['desktop', 'mobile'];

/** "25 Nov 2026" and "25 Nov 2026, 14:32" in the viewer's time zone. */
export const dateText = (ms: number): string =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const dateTimeText = (ms: number): string =>
  `${dateText(ms)}, ${new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
