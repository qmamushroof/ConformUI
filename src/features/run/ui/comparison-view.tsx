import type { Finding, Rect } from '@kernel';
import { type FC, useEffect, useId, useRef, useState } from 'react';
import { Icon } from './icon';
import { diffSentence, VP_NAME } from './labels';

/** An image the app resolved to a URL (object URL of a stored blob) with its pixel size. */
export interface EvidenceImage {
  src: string;
  width: number;
  height: number;
}

/** Design crop and capture crop side by side (SPEC-UI-01, PRD-F-05.1, PRD-F-05.4). */
export interface ComparisonViewProps {
  finding: Finding;
  /** The design image of the Finding's viewport. */
  design?: EvidenceImage;
  /** The capture image the Run used for the Finding's viewport. */
  capture?: EvidenceImage;
  /** Optional pixelmatch mask, same size as the capture; without it the overlay fills the capture region. */
  diff?: EvidenceImage;
  /** A presence failure: nothing is drawn where the design shows content, so the implementation crop is empty. */
  nothingDrawn?: boolean;
}

const PAD = 32;

/** Both crops use the same viewBox size so the two images share one CSS scale (SPEC-UI-01). */
function viewBoxes(d: Rect | undefined, c: Rect | undefined, design?: EvidenceImage, capture?: EvidenceImage) {
  const whole = (i?: EvidenceImage) => `0 0 ${i?.width ?? 1} ${i?.height ?? 1}`;
  const base = d ?? c;
  if (!base) return { design: whole(design), capture: whole(capture) };
  const w = Math.max(d?.w ?? 0, c?.w ?? 0) + 2 * PAD;
  const h = Math.max(d?.h ?? 0, c?.h ?? 0) + 2 * PAD;
  const at = (r: Rect | undefined) => `${(r ?? base).x - PAD} ${(r ?? base).y - PAD} ${w} ${h}`;
  return { design: at(d), capture: at(c) };
}

const Shot: FC<{
  image: EvidenceImage;
  label: string;
  viewBox: string;
  crop?: Rect;
  kind: 'design' | 'impl';
  full: boolean;
  diff?: { rect?: Rect; image?: EvidenceImage };
  /** The pane's scroll element, for the two panes to follow each other. */
  paneRef?: (el: HTMLDivElement | null) => void;
  onPaneScroll?: (el: HTMLDivElement) => void;
}> = ({ image, label, viewBox, crop, kind, full, diff, paneRef, onPaneScroll }) => {
  const scroller = useRef<HTMLDivElement | null>(null);
  // Full page: the image is scaled to the pane width, so only the vertical position is set, centring the region.
  useEffect(() => {
    const el = scroller.current;
    if (!full || !el) return;
    if (!crop || !el.clientWidth || image.width <= 0) {
      el.scrollTop = 0;
      return;
    }
    const scale = el.clientWidth / image.width;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = Math.min(max, Math.max(0, (crop.y + crop.h / 2) * scale - el.clientHeight / 2));
  }, [full, crop, image.width]);

  const svg = (
    <svg
      className="shot"
      viewBox={full ? `0 0 ${image.width} ${image.height}` : viewBox}
      role="img"
      aria-label={label}
      style={full ? { width: '100%' } : undefined}
    >
      <image href={image.src} x={0} y={0} width={image.width} height={image.height} />
      {diff?.image ? (
        <image className="diffmask" href={diff.image.src} x={0} y={0} width={image.width} height={image.height} />
      ) : diff?.rect ? (
        <rect className="diffmask" x={diff.rect.x} y={diff.rect.y} width={diff.rect.w} height={diff.rect.h} />
      ) : null}
      {crop && (
        <rect
          className={kind === 'design' ? 'rg-design' : 'rg-impl'}
          x={crop.x}
          y={crop.y}
          width={crop.w}
          height={crop.h}
          rx={6}
        />
      )}
    </svg>
  );
  return full ? (
    <div
      className="shot-scroll"
      style={{ overflowX: 'hidden' }}
      ref={(el) => {
        scroller.current = el;
        paneRef?.(el);
      }}
      onScroll={(e) => onPaneScroll?.(e.currentTarget)}
    >
      {svg}
    </div>
  ) : (
    svg
  );
};

export const ComparisonView: FC<ComparisonViewProps> = ({ finding, design, capture, diff, nothingDrawn }) => {
  const uid = useId();
  const panes = useRef<{ design?: HTMLDivElement | null; impl?: HTMLDivElement | null }>({});
  /** The two panes scroll together by proportion, since the design and the capture differ in height. */
  const follow = (from: 'design' | 'impl') => (el: HTMLDivElement) => {
    const other = panes.current[from === 'design' ? 'impl' : 'design'];
    if (!other) return;
    const span = el.scrollHeight - el.clientHeight;
    const ratio = span > 0 ? el.scrollTop / span : 0;
    const target = ratio * Math.max(0, other.scrollHeight - other.clientHeight);
    // The other pane's own scroll event lands within a pixel of here, which ends the echo.
    if (Math.abs(other.scrollTop - target) >= 1) other.scrollTop = target;
  };
  const [showDiff, setShowDiff] = useState(false);
  const [full, setFull] = useState(false);
  const { designCrop, captureCrop, diffRatio } = finding.evidence;
  const boxes = viewBoxes(designCrop, captureCrop, design, capture);
  const sentence = diffSentence(diffRatio);
  const vp = VP_NAME[finding.viewport];
  const hasEvidence = design !== undefined || capture !== undefined;
  const noteId = `${uid}-note`;
  const headId = `${uid}-h`;

  return (
    <section className="sec" aria-labelledby={headId}>
      <div className="sec-head">
        <h3 id={headId}>Evidence</h3>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-ghost toggle"
            aria-pressed={showDiff}
            aria-describedby={noteId}
            onClick={() => setShowDiff((v) => !v)}
          >
            <Icon name="layers" small />
            Diff overlay
          </button>
          <button type="button" className="btn btn-ghost toggle" aria-pressed={full} onClick={() => setFull((v) => !v)}>
            <Icon name="expand" small />
            Full page
          </button>
        </div>
      </div>
      {hasEvidence ? (
        <div className={`evidence${showDiff ? ' show-diff' : ''}`}>
          <figure className="fig">
            <figcaption>
              <b>
                <span className="legend" aria-hidden="true" />
                Design
              </b>
              <span>{design ? `${design.width} × ${design.height}` : 'none'}</span>
            </figcaption>
            {design ? (
              <Shot
                image={design}
                label={`Design: ${finding.statement}`}
                viewBox={boxes.design}
                kind="design"
                full={full}
                paneRef={(el) => {
                  panes.current.design = el;
                }}
                onPaneScroll={follow('design')}
                {...(designCrop && { crop: designCrop })}
              />
            ) : (
              <div className="nodesign">
                <div className="stack-sm">
                  <strong>No {vp} design</strong>
                  <span>
                    {finding.label === 'inferred'
                      ? `Inferred: ${finding.condition}`
                      : 'This check uses the capture and DOM snapshot only.'}
                  </span>
                </div>
              </div>
            )}
          </figure>
          <figure className="fig">
            <figcaption>
              <b>
                <span className="legend dashed" aria-hidden="true" />
                Implementation
              </b>
              <span>{capture ? `${capture.width} × ${capture.height}` : 'none'}</span>
            </figcaption>
            {capture ? (
              <Shot
                image={capture}
                label={`Implementation: ${finding.statement}`}
                viewBox={boxes.capture}
                kind="impl"
                full={full}
                paneRef={(el) => {
                  panes.current.impl = el;
                }}
                onPaneScroll={follow('impl')}
                diff={{
                  ...(captureCrop && { rect: captureCrop }),
                  ...(diff && { image: diff }),
                }}
                {...(captureCrop && { crop: captureCrop })}
              />
            ) : (
              <div className="nodesign">
                <div className="stack-sm">
                  <strong>No {vp} capture</strong>
                  <span>Add a capture to see the implementation.</span>
                </div>
              </div>
            )}
            {capture && nothingDrawn ? <p className="small muted">Nothing drawn here</p> : null}
          </figure>
        </div>
      ) : (
        <p className="small muted">
          Evidence could not be produced for this finding. The measurements below still apply.
        </p>
      )}
      <p className="small muted" id={noteId}>
        {showDiff ? `Diff overlay on, shown in magenta. ${sentence}` : `Diff overlay off. ${sentence}`}
      </p>
    </section>
  );
};
