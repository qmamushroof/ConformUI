import { type Capture, CuiError, type DesignRef, type DomSnapshot, type Project, type ViewportId } from '@kernel';
import { type ClipboardEvent, type FC, type ReactNode, useId, useRef, useState } from 'react';
import type { ProjectsService } from '../types';
import { Icon } from './icon';
import { IMAGE_LIMITS_HELP, ImageDropZone } from './image-drop-zone';
import { RELEASE_VIEWPORTS, viewportLabel, viewportName } from './labels';
import { Sheet } from './sheet';
import { Toasts, useToast } from './toast';

/** Per-viewport design and capture inputs of one Project (SPEC-PROJ-01..04, SPEC §5.1). */
export interface ProjectInputsProps {
  project: Project;
  service: Pick<ProjectsService, 'addDesign' | 'addCapture' | 'attachSnapshot' | 'suggestViewport'>;
  /** Columns to show; default Desktop and Mobile. */
  viewports?: ViewportId[];
  /** Viewports whose latest Run results are stale (`staleViewports`, SPEC-PROJ-04). */
  stale?: ViewportId[];
  /** Object URL (or other source) of a stored image, for thumbnails. */
  imageSrc?(blobId: string): string | undefined;
  /**
   * The paste field for one snapshot (`SnapshotPasteField` of `dom-snippet`), injected by `app` because features do not
   * import each other (SPEC-ARCH-07).
   */
  snapshotField?(a: {
    viewport: ViewportId;
    cssWidth: number;
    onAccept(s: DomSnapshot): void;
    onCancel(): void;
  }): ReactNode;
  /** Link target of "Get the snippet". */
  snippetHref?: string;
  /** Called after any input was stored, so the parent reloads the Project. */
  onChange?(): void;
}

const NOT_ADDED_HINT =
  'Nothing else changed. Use PNG, JPEG or WebP up to 20 MB and 8192 px per side. For a long page, export the first screen or crop it into parts.';

const message = (e: unknown) => (e instanceof CuiError || e instanceof Error ? e.message : 'it could not be read');
const sizeText = (i: { width: number; height: number; bytes: number }) =>
  `${i.width} × ${i.height} · ${Math.max(1, Math.round(i.bytes / 1024))} KB`;

function firstImage(e: ClipboardEvent): File | undefined {
  for (const item of Array.from(e.clipboardData?.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  return undefined;
}

interface CaptureDraft {
  vp: ViewportId;
  file?: File;
  suggested?: boolean;
  error?: string;
  busy?: boolean;
}

export const ProjectInputs: FC<ProjectInputsProps> = ({
  project,
  service,
  viewports = RELEASE_VIEWPORTS,
  stale = [],
  imageSrc,
  snapshotField,
  snippetHref = '/snippet',
  onChange,
}) => {
  const [problem, setProblem] = useState<{ vp: ViewportId; name: string; reason: string }>();
  const [draft, setDraft] = useState<CaptureDraft>();
  const [snap, setSnap] = useState<{ vp: ViewportId; error?: string }>();
  const [toast, say] = useToast();
  const token = useRef(0);

  const addDesign = async (vp: ViewportId, file: File) => {
    setProblem(undefined);
    try {
      await service.addDesign(project.id, file, vp);
      onChange?.();
    } catch (e) {
      setProblem({ vp, name: file.name, reason: message(e) });
    }
  };

  const chooseCapture = async (file: File, fallback: ViewportId) => {
    const mine = ++token.current;
    setDraft((d) => ({ vp: d?.vp ?? fallback, file, error: undefined }));
    try {
      const vp = await service.suggestViewport(file);
      if (mine === token.current) setDraft((d) => (d ? { ...d, vp, suggested: true } : d));
    } catch {
      // The column viewport stays selected; the codec reports the real problem when the capture is added.
    }
  };

  const openCapture = (vp: ViewportId, file?: File) => {
    setProblem(undefined);
    setDraft({ vp });
    if (file) void chooseCapture(file, vp);
  };

  const submitCapture = async () => {
    if (!draft?.file || draft.busy) return;
    const { file, vp } = draft;
    setDraft({ ...draft, busy: true, error: undefined });
    try {
      await service.addCapture(project.id, file, vp);
      setDraft(undefined);
      say(`${viewportLabel(vp)} capture added`);
      onChange?.();
    } catch (e) {
      setDraft({ ...draft, busy: false, error: `${file.name} was not added: ${message(e)}` });
    }
  };

  const acceptSnapshot = async (vp: ViewportId, dom: DomSnapshot) => {
    const cap = project.captures.find((c) => c.viewport === vp);
    if (!cap) return;
    try {
      await service.attachSnapshot(project.id, cap.id, dom);
      setSnap(undefined);
      say(`Snapshot added, ${dom.elements.length} elements`);
      onChange?.();
    } catch (e) {
      setSnap({ vp, error: message(e) });
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLElement>) => {
    const f = firstImage(e);
    if (!f) return;
    e.preventDefault();
    openCapture(viewports[0] ?? 'desktop', f);
  };

  return (
    <section className="stack-lg" id="captures" aria-labelledby="in-h" onPaste={onPaste}>
      <h2 id="in-h">Inputs</h2>

      {problem ? (
        <div className="notice notice-danger" role="alert" id="img-err">
          <Icon name="alert" />
          <p className="title">
            {problem.name} was not added: {problem.reason}
          </p>
          <p className="small">{NOT_ADDED_HINT}</p>
        </div>
      ) : null}

      <div className="two">
        {viewports.map((vp) => (
          <Column
            key={vp}
            vp={vp}
            design={project.designs.find((d) => d.viewport === vp)}
            capture={project.captures.find((c) => c.viewport === vp)}
            stale={stale.includes(vp)}
            error={problem?.vp === vp ? problem.reason : undefined}
            imageSrc={imageSrc}
            snippetHref={snippetHref}
            onDesign={(f) => void addDesign(vp, f)}
            onCapture={() => openCapture(vp)}
            onSnapshot={() => setSnap({ vp })}
          />
        ))}
      </div>

      {draft ? (
        <CaptureSheet
          draft={draft}
          viewports={viewports}
          onFile={(f) => void chooseCapture(f, draft.vp)}
          onViewport={(vp) => setDraft({ ...draft, vp })}
          onClose={() => {
            token.current++;
            setDraft(undefined);
          }}
          onSubmit={() => void submitCapture()}
        />
      ) : null}

      {snap ? (
        <SnapshotSheet
          vp={snap.vp}
          cssWidth={project.captures.find((c) => c.viewport === snap.vp)?.image.cssWidth ?? 0}
          error={snap.error}
          snippetHref={snippetHref}
          field={snapshotField}
          onAccept={(dom) => void acceptSnapshot(snap.vp, dom)}
          onClose={() => setSnap(undefined)}
        />
      ) : null}
      <Toasts message={toast} />
    </section>
  );
};

const Column: FC<{
  vp: ViewportId;
  design?: DesignRef;
  capture?: Capture;
  stale: boolean;
  error?: string;
  imageSrc?(blobId: string): string | undefined;
  snippetHref: string;
  onDesign(f: File): void;
  onCapture(): void;
  onSnapshot(): void;
}> = ({ vp, design, capture, stale, error, imageSrc, snippetHref, onDesign, onCapture, onSnapshot }) => {
  const id = useId();
  const name = viewportName(vp);
  const replace = useRef<HTMLInputElement>(null);
  const dom = capture?.dom;
  const matches = dom && capture ? Math.abs(dom.viewport.width - capture.image.cssWidth) <= 1 : true;

  return (
    <section className="vp" aria-labelledby={`${id}-h`}>
      <h3 className="vp-h" id={`${id}-h`}>
        <Icon name={vp === 'mobile' ? 'phone' : 'desktop'} />
        {viewportLabel(vp)}
      </h3>

      <div className="slot">
        <span className="label small">Design</span>
        {design ? (
          <div className="thumb">
            {imageSrc?.(design.image.blobId) ? (
              <img className="shot" src={imageSrc(design.image.blobId)} alt={`${name} design`} />
            ) : (
              <span className="shot" aria-hidden="true" />
            )}
            <div className="small">
              <div className="name">{name} design</div>
              <div className="muted">{sizeText(design.image)}</div>
            </div>
            <button
              className="iconbtn"
              type="button"
              aria-label={`Replace ${name} design`}
              onClick={() => replace.current?.click()}
            >
              <Icon name="refresh" small />
            </button>
            <input
              ref={replace}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) onDesign(f);
              }}
            />
          </div>
        ) : vp === 'desktop' ? (
          <ImageDropZone
            label={`Drop the ${name} design, or choose a file`}
            help={`${IMAGE_LIMITS_HELP} From a design tool, export the frame as PNG.`}
            error={error}
            describedBy={error ? 'img-err' : undefined}
            onFile={onDesign}
          />
        ) : (
          <>
            <p className="none">None. {name} requirements are inferred from Desktop.</p>
            <div>
              <button className="btn btn-ghost" type="button" onClick={() => replace.current?.click()}>
                <Icon name="plus" small />
                Add a {name} design
              </button>
              <input
                ref={replace}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                tabIndex={-1}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) onDesign(f);
                }}
              />
            </div>
          </>
        )}
      </div>

      <div className="slot">
        <span className="label small">Capture</span>
        {capture ? (
          <div className="thumb">
            {imageSrc?.(capture.image.blobId) ? (
              <img className="shot" src={imageSrc(capture.image.blobId)} alt={`${name} capture of the built page`} />
            ) : (
              <span className="shot" aria-hidden="true" />
            )}
            <div className="small">
              <div className="name">{name} capture</div>
              <div className="muted">{sizeText(capture.image)}</div>
            </div>
            <button className="iconbtn" type="button" aria-label={`Replace ${name} capture`} onClick={onCapture}>
              <Icon name="refresh" small />
            </button>
          </div>
        ) : (
          <button className="drop" type="button" onClick={onCapture}>
            <Icon name="image" large />
            <span className="t">Add a {name} capture</span>
            <span className="help">
              {vp === 'mobile'
                ? 'A screenshot at 390 px wide. Phone screenshots at 2× or 3× density are scaled down.'
                : 'A screenshot of your built page at 1440 px wide. Full-page screenshots work.'}
            </span>
          </button>
        )}
        {stale ? (
          <p className="st st-review">
            <Icon name="review" />
            Captures changed: Re-verify
          </p>
        ) : null}
      </div>

      <div className="snapline">
        <span className="label small muted">DOM snapshot</span>
        {dom ? (
          <div className="row">
            <span className="st st-pass">
              <Icon name="check" />
              Snapshot added, {dom.elements.length} elements
            </span>
            <span className="small muted">
              {dom.viewport.width} × {dom.viewport.height}, {matches ? 'matches' : 'differs from'} the capture
            </span>
          </div>
        ) : (
          <div className="stack-sm" style={{ gap: 0 }}>
            <p className="small">
              <span className="st st-nc">
                <Icon name="dash" />
                No snapshot.
              </span>{' '}
              Measured DOM checks will be Not checked.
            </p>
            <div className="btn-row">
              <button
                className="btn btn-ghost"
                type="button"
                aria-disabled={capture ? undefined : 'true'}
                aria-describedby={capture ? undefined : `${id}-why`}
                onClick={() => (capture ? onSnapshot() : undefined)}
              >
                <Icon name="code" small />
                Paste snapshot
              </button>
              <a href={snippetHref} className="small tlink">
                Get the snippet
              </a>
            </div>
            {capture ? null : (
              <p className="help" id={`${id}-why`}>
                Add a capture first.
              </p>
            )}
          </div>
        )}
        {dom ? (
          <div className="btn-row">
            <button className="btn btn-ghost" type="button" onClick={onSnapshot}>
              <Icon name="code" small />
              Paste snapshot
            </button>
            <a href={snippetHref} className="small tlink">
              Get the snippet
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
};

const CaptureSheet: FC<{
  draft: CaptureDraft;
  viewports: ViewportId[];
  onFile(f: File): void;
  onViewport(vp: ViewportId): void;
  onClose(): void;
  onSubmit(): void;
}> = ({ draft, viewports, onFile, onViewport, onClose, onSubmit }) => {
  const id = useId();
  const close = useRef<HTMLButtonElement>(null);
  const ready = Boolean(draft.file) && !draft.busy;
  return (
    <Sheet labelledBy={`${id}-h`} onClose={onClose} initialFocus={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onSubmit();
        }}
      >
        <div className="sheet-head">
          <div className="stack-sm">
            <h2 id={`${id}-h`}>Add capture</h2>
            <p className="muted small">A screenshot of your built page. It stays on this device.</p>
          </div>
          <button ref={close} className="iconbtn" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <ImageDropZone icon="image" label="Drop a screenshot, paste it, or choose a file" onFile={onFile} />
        {draft.file ? (
          <p className="small">
            <span className="name">{draft.file.name}</span>
          </p>
        ) : null}
        <fieldset className="stack-sm">
          <legend>Viewport</legend>
          {viewports.map((v) => (
            <label className="choice" key={v}>
              <input type="radio" name={`${id}-vp`} checked={draft.vp === v} onChange={() => onViewport(v)} />
              <span>{viewportLabel(v)}</span>
              {draft.suggested && draft.vp === v ? <span className="help">Suggested from the image width.</span> : null}
            </label>
          ))}
        </fieldset>
        <p className="small muted">
          Replacing a capture keeps the contract. Only that viewport's latest run results are cleared.
        </p>
        {draft.error ? (
          <p className="error" role="alert">
            <Icon name="alert" small />
            {draft.error}
          </p>
        ) : null}
        <div className="sheet-foot">
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" aria-disabled={ready ? 'false' : 'true'}>
            <Icon name="plus" small />
            Add capture
          </button>
        </div>
      </form>
    </Sheet>
  );
};

const SnapshotSheet: FC<{
  vp: ViewportId;
  cssWidth: number;
  error?: string;
  snippetHref: string;
  field: ProjectInputsProps['snapshotField'];
  onAccept(dom: DomSnapshot): void;
  onClose(): void;
}> = ({ vp, cssWidth, error, snippetHref, field, onAccept, onClose }) => {
  const id = useId();
  const close = useRef<HTMLButtonElement>(null);
  return (
    <Sheet labelledBy={`${id}-h`} onClose={onClose} initialFocus={close} wide>
      <div className="sheet-head">
        <div className="stack-sm">
          <h2 id={`${id}-h`}>Paste DOM snapshot, {viewportLabel(vp)}</h2>
          <p className="muted small">
            Run the snippet on your page at {cssWidth} px wide, then paste the JSON it copied.{' '}
            <a href={snippetHref}>Get the snippet</a>
          </p>
        </div>
        <button ref={close} className="iconbtn" type="button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      {field?.({ viewport: vp, cssWidth, onAccept, onCancel: onClose })}
      {error ? (
        <p className="error" role="alert">
          <Icon name="alert" small />
          {error}
        </p>
      ) : null}
    </Sheet>
  );
};
