import type { Rect, Requirement } from '@kernel';
import type { FC } from 'react';
import { regionDisplay } from '../display';

export interface DesignCanvasProps {
  /** Design image URL, if the design is loaded. */
  src?: string;
  width: number;
  height: number;
  label: string;
  /** Requirements of this viewport whose regions are outlined. */
  requirements: Requirement[];
  selectedId?: string;
  highlightId?: string | null;
  onSelect?(id: string): void;
}

const outset = (r: Rect) => ({ x: r.x - 4, y: r.y - 4, width: r.w + 8, height: r.h + 8 });
const holds = (a: Rect, b: Rect) =>
  a !== b &&
  !(a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h) &&
  a.x <= b.x &&
  a.y <= b.y &&
  a.x + a.w >= b.x + b.w &&
  a.y + a.h >= b.y + b.h;

/**
 * The design image with a region outline per requirement (SPEC-CON-07): faint 1 px for the others, strong for the
 * selected one, dashed when the region is unresolved. Containers of another region show only when selected, so
 * faint lines never cross text. Every outline is also a button-like target for selection.
 */
export const DesignCanvas: FC<DesignCanvasProps> = ({
  src,
  width,
  height,
  label,
  requirements,
  selectedId,
  highlightId,
  onSelect,
}) => {
  const shown = requirements.flatMap((r) => {
    const d = regionDisplay(r);
    return d.kind === 'outlined' ? [{ id: r.id, rect: d.rect, dashed: d.dashed }] : [];
  });
  const isContainer = (s: (typeof shown)[number]) => shown.some((o) => holds(s.rect, o.rect));
  const visible = shown.filter((s) => s.dashed || s.id === selectedId || !isContainer(s));
  const ordered = [...visible.filter((s) => s.id !== selectedId), ...visible.filter((s) => s.id === selectedId)];
  return (
    <svg className="shot canvas" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {src ? <image href={src} x={0} y={0} width={width} height={height} /> : null}
      {ordered.map((s) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: the requirement list is the keyboard path for the same selection
        // biome-ignore lint/a11y/useKeyWithClickEvents: same
        <rect
          key={s.id}
          className={`rg${s.dashed ? ' unres' : ''}${s.id === selectedId ? ' sel' : ''}${s.id === highlightId ? ' hl' : ''}`}
          data-id={s.id}
          {...outset(s.rect)}
          rx={4}
          onClick={() => onSelect?.(s.id)}
        />
      ))}
    </svg>
  );
};
