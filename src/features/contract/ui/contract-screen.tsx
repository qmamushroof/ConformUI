import type { Contract, Engine, ManualRequirementDraft, Project, Requirement, ViewportId } from '@kernel';
import { type FC, type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { regionDisplay, UNRESOLVED_REGION_NOTE } from '../display';
import { DesignCanvas } from './design-canvas';
import { Icon } from './icon';
import { RequirementEditor } from './requirement-editor';
import { CATEGORY_TEXT, CHECK_TEXT, RequirementRow } from './requirement-row';

export interface ExtractStage {
  label: string;
  state: 'done' | 'run' | 'wait';
  detail: string;
  percent: number;
}
export interface ExtractingView {
  engine: Engine;
  /** "Desktop" in "Extracting requirements from the Desktop design". */
  viewportLabel: string;
  stages: ExtractStage[];
}
/** An item in the comparison with the statement of the contract it belongs to (AI and verified ids can collide). */
export interface ComparisonItem {
  id: string;
  statement: string;
}
export interface Comparison {
  matched: string[];
  /** Verified items the AI did not propose. */
  missing: ComparisonItem[];
  /** AI items with no verified counterpart. */
  extra: ComparisonItem[];
}

/** Routed screen `/p/:projectId/contract` (SPEC §4.13.2). Data and services come in as props; navigation is a callback (SPEC-ARCH-07). */
export interface ContractScreenProps {
  project: Project;
  /** Active contract. */
  contract?: Contract;
  /** AI draft awaiting review: shown instead of the active one, which stays active (SPEC-CON-09, SPEC-DEMO-03). */
  pending?: Contract;
  pendingSource?: 'on-device' | 'cloud' | 'precomputed';
  /** The sentence under a pre-computed draft's title: why the stored results are shown (`app` knows the reason). */
  pendingNote?: string;
  comparison?: Comparison;
  /** Object URLs of the design images by viewport, resolved by `app`. */
  designSrc?: Partial<Record<ViewportId, string>>;
  lockedBy?: string;
  service: {
    accept(contractId: string, reqIds: string[] | 'all'): Promise<Contract>;
    editText(contractId: string, reqId: string, patch: { statement?: string; condition?: string }): Promise<Contract>;
    remove(contractId: string, reqId: string): Promise<Contract>;
    add(contractId: string, draft: ManualRequirementDraft): Promise<Contract>;
  };
  /** Creates the first contract when a manual requirement is added before any extraction. */
  ensureContract?(): Promise<Contract>;
  extracting?: ExtractingView;
  extractError?: { title: string; detail?: string; code?: string };
  onExtract(): void;
  onStopExtract?(): void;
  onAddDesign?(): void;
  onContinue?(): void;
  onUseAi?(): void;
  onKeepVerified?(): void;
  onExport?(format: 'md' | 'json'): void;
  onChange?(c: Contract): void;
  /** `EngineBadge` from settings, passed by `app` so features do not import each other. */
  renderBadge?(r: Requirement): ReactNode;
}

const VP_ORDER: ViewportId[] = ['desktop', 'mobile', 'tablet'];
const VP_TEXT: Record<ViewportId, string> = { desktop: 'Desktop 1440', mobile: 'Mobile 390', tablet: 'Tablet 768' };
const VP_NAME: Record<ViewportId, string> = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const rectText = (r: { x: number; y: number; w: number; h: number }) => `${r.w} × ${r.h} px at ${r.x}, ${r.y}`;

const CHECKED_BY = {
  judged: 'A model at run time (On-device, or Cloud with consent)',
  visual: 'Image comparison on this device',
  measured: 'Measured on this device from the DOM snapshot',
} as const;

function regionText(r: Requirement, hasDesign: boolean): string {
  const d = regionDisplay(r);
  if (d.kind === 'outlined' && d.dashed) return UNRESOLVED_REGION_NOTE;
  if (d.kind === 'outlined') {
    return d.source === 'snapped'
      ? 'Snapped to element bounds, design image'
      : d.source === 'user'
        ? 'Drawn by you'
        : 'From the verified sample contract';
  }
  if (!hasDesign) {
    return `No ${VP_NAME[r.viewport]} design. ${
      r.derivedFrom ? `Derived from ${r.derivedFrom}.` : `Applies to the whole ${VP_NAME[r.viewport]} capture.`
    }`;
  }
  return 'None';
}

function boundsText(r: Requirement): string {
  const d = regionDisplay(r);
  if (d.kind === 'none') return 'None';
  return d.dashed ? `Suggested by AI: ${rectText(d.rect)} (not snapped)` : rectText(d.rect);
}

const EngineText: FC<{ engine: Engine }> = ({ engine }) => (
  <span className="eng">
    <Icon name={engine === 'cloud' ? 'cloud' : 'chip'} />
    {engine === 'cloud' ? 'Cloud' : 'On-device'}
  </span>
);

/** Seconds since it appeared: the extraction view mounts it per run, so it restarts at 0 for each. Not a live region (one update a second would be noise). */
const Elapsed: FC = () => {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{s < 60 ? `${s} s elapsed.` : `${Math.floor(s / 60)} min ${s % 60} s elapsed.`}</span>;
};

export const ContractScreen: FC<ContractScreenProps> = (props) => {
  const { project, service, extracting, extractError, comparison, designSrc = {} } = props;
  const shown = props.pending ?? props.contract;
  const reviewing = props.pending !== undefined;
  const [cur, setCur] = useState<Contract | undefined>(shown);
  useEffect(() => setCur(shown), [shown]);

  const [sel, setSel] = useState<string | undefined>(undefined);
  const [hl, setHl] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftSt, setDraftSt] = useState('');
  const [draftCond, setDraftCond] = useState('');
  const [stErr, setStErr] = useState(false);
  const [editV2, setEditV2] = useState(false);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const ids = useId();
  const detailTitle = useRef<HTMLHeadingElement>(null);

  const reqs = cur?.requirements ?? [];
  const selected = reqs.find((r) => r.id === sel) ?? reqs[0];
  const designs = project.designs;
  const designOf = (v: ViewportId) => designs.find((d) => d.viewport === v);
  const hasDesign = designs.length > 0;
  const locked = !!cur?.locked && !editV2 && !reviewing;
  const editable = !locked && !extracting;
  const accepted = reqs.filter((r) => r.accepted).length;
  const unaccepted = reqs.length - accepted;
  const source = props.pendingSource ?? 'on-device';
  const busy = extracting !== undefined;
  const showEmpty = !hasDesign && reqs.length === 0 && !busy;
  const showSplit = !busy && !showEmpty;

  /** One review edit: the service returns the new Contract (a locked one becomes the next version, SPEC-CON-06). */
  async function run(op: () => Promise<Contract>, then?: (before: Contract | undefined, next: Contract) => void) {
    setActionError(null);
    try {
      const before = cur;
      const next = await op();
      setCur(next);
      props.onChange?.(next);
      then?.(before, next);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong. Nothing was changed.');
    }
  }

  const select = (id: string) => {
    setSel(id);
    setEditing(null);
    const r = reqs.find((x) => x.id === id);
    if (r) setAnnounce(r.statement);
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (reqs.length === 0) return;
    const at = Math.max(
      0,
      reqs.findIndex((r) => r.id === selected?.id),
    );
    const go = (i: number) => {
      e.preventDefault();
      const r = reqs[Math.min(reqs.length - 1, Math.max(0, i))];
      if (r) select(r.id);
    };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(reqs.length - 1);
    else if (e.key === 'Enter') {
      e.preventDefault();
      detailTitle.current?.focus({ preventScroll: true });
    }
  };

  const startEdit = (r: Requirement) => {
    setEditing(r.id);
    setDraftSt(r.statement);
    setDraftCond(r.condition);
    setStErr(false);
  };
  const saveEdit = (r: Requirement) => {
    const statement = draftSt.trim();
    if (!statement) {
      setStErr(true);
      return;
    }
    const condition = draftCond.trim() || r.condition;
    setEditing(null);
    if (cur) void run(() => service.editText(cur.id, r.id, { statement, condition }));
  };

  const addDraft = async (draft: ManualRequirementDraft) => {
    setAdding(false);
    const base = cur ?? (await props.ensureContract?.());
    if (!base) {
      setActionError('Add a design image first, then add requirements.');
      return;
    }
    const known = new Set(base.requirements.map((r) => r.id));
    await run(
      () => service.add(base.id, draft),
      (_b, next) => {
        const added = next.requirements.find((r) => !known.has(r.id));
        if (added) select(added.id);
      },
    );
  };

  const group = (v: ViewportId) => reqs.filter((r) => r.viewport === v);
  const groups = VP_ORDER.filter((v) => group(v).length > 0);

  const title = reviewing ? 'AI contract (draft)' : cur ? `Contract v${cur.version}` : 'Contract';
  const meta = reviewing
    ? [
        `${plural(reqs.length, 'requirement', 'requirements')}, ${accepted} accepted`,
        `Not active: runs use the verified contract${props.contract ? ` v${props.contract.version}` : ''}`,
      ]
    : cur
      ? [
          plural(reqs.length, 'requirement', 'requirements'),
          cur.locked ? (props.lockedBy ? `Locked by ${props.lockedBy}` : 'Locked') : 'Active',
          'Desktop 1440 and Mobile 390',
        ]
      : ['No requirements yet', 'Desktop 1440 and Mobile 390'];

  const reasonId = `${ids}-reason`;

  const reviewTitle =
    source === 'precomputed'
      ? `Sample results (pre-computed): ${plural(reqs.length, 'requirement', 'requirements')}. Review them, then accept.`
      : `AI extracted ${plural(reqs.length, 'requirement', 'requirements')}, ${source === 'cloud' ? 'Cloud' : 'On-device'}. Review them, then accept.`;
  const reviewSub =
    source === 'precomputed'
      ? (props.pendingNote ??
        'These are the sample’s stored extraction results, labelled Pre-computed. The verified contract stays active until you choose below.')
      : source === 'cloud'
        ? 'The list you approved was sent to Google Gemini through Firebase for this project. The verified contract stays active until you choose below.'
        : 'Nothing was sent off this device. AI regions are suggestions, snapped to element bounds on the design image. The verified contract stays active until you choose below.';

  const acceptAll = () => {
    if (cur) void run(() => service.accept(cur.id, 'all'));
  };

  return (
    <main id="main" tabIndex={-1} className="tool">
      <div className="chead">
        <div className="stack-sm">
          <h1 id="c-title">{title}</h1>
          <div className="meta">
            {meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
            {!reviewing && cur ? <span className="mono xs">{cur.id}</span> : null}
          </div>
        </div>
        <div className="btn-row">
          <button
            className="btn btn-ghost"
            type="button"
            aria-disabled={!hasDesign || busy ? true : undefined}
            aria-busy={busy ? true : undefined}
            aria-describedby={hasDesign ? undefined : reasonId}
            onClick={() => {
              if (hasDesign && !busy) props.onExtract();
            }}
          >
            <Icon name="chip" small />
            Extract contract
          </button>
          {!busy && !locked ? (
            <button className="btn btn-ghost" type="button" onClick={() => setAdding(true)}>
              <Icon name="plus" small />
              Add requirement
            </button>
          ) : null}
          <div className="menu-wrap">
            <button
              className="iconbtn"
              type="button"
              aria-haspopup="true"
              aria-expanded={menu}
              aria-label="More contract actions"
              onClick={() => setMenu((m) => !m)}
              onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}
            >
              <Icon name="more" />
            </button>
            <div className="menu" hidden={!menu}>
              {(
                [
                  ['md', 'Export contract as Markdown'],
                  ['json', 'Export contract as JSON'],
                ] as const
              ).map(([fmt, text]) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    props.onExport?.(fmt);
                  }}
                >
                  <Icon name="download" small />
                  {text}
                </button>
              ))}
              {cur ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    try {
                      void navigator.clipboard?.writeText(cur.id);
                      setAnnounce('Contract ID copied');
                    } catch {
                      setAnnounce('Could not copy the contract ID');
                    }
                  }}
                >
                  <Icon name="copy" small />
                  Copy contract ID
                </button>
              ) : null}
            </div>
          </div>
          {cur && !reviewing && !busy ? (
            <button className="btn btn-primary" type="button" onClick={props.onContinue}>
              Continue to captures
              <Icon name="chev" small />
            </button>
          ) : null}
        </div>
      </div>
      {hasDesign ? null : (
        <p
          className="small muted"
          id={reasonId}
          style={{ padding: '0 var(--space-6) var(--space-4)', marginTop: 'calc(-1 * var(--space-3))' }}
        >
          Extract contract needs a design. Add a design image (PNG, JPEG or WebP, up to 20 MB). From a design tool,
          export the frame as PNG.
        </p>
      )}

      {extractError ? (
        <div className="cband">
          <div className="notice notice-danger" role="alert">
            <Icon name="alert" />
            <p className="title">{extractError.title}</p>
            {extractError.detail || extractError.code ? (
              <p className="small muted">
                {extractError.detail} {extractError.code ? <span className="mono">{extractError.code}</span> : null}
              </p>
            ) : null}
            {hasDesign && !busy ? (
              <div className="btn-row">
                <button className="btn btn-ghost" type="button" onClick={props.onExtract}>
                  Try again
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {actionError ? (
        <div className="cband">
          <div className="notice notice-danger" role="alert">
            <Icon name="alert" />
            <p className="title">{actionError}</p>
          </div>
        </div>
      ) : null}

      {locked ? (
        <div className="cband">
          <div className="notice" role="status">
            <Icon name="lock" />
            <p className="title">{`Locked by ${props.lockedBy ?? 'a Run'}. Editing creates Contract v${(cur?.version ?? 1) + 1}.`}</p>
            <p className="small muted">
              {`${props.lockedBy ?? 'The Run'} keeps pointing at v${cur?.version ?? 1}, so its findings stay comparable. Contract v${(cur?.version ?? 1) + 1} starts with the same ${plural(reqs.length, 'requirement', 'requirements')}.`}
            </p>
            <div className="btn-row">
              <button className="btn btn-ghost" type="button" onClick={() => setEditV2(true)}>
                <Icon name="edit" small />
                Edit as v2
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewing ? (
        <div className="cband">
          <div className="notice notice-info" role="status">
            <Icon name="info" />
            <p className="title">{reviewTitle}</p>
            <p className="small muted">{reviewSub}</p>
            <div className="btn-row">
              <button className="btn btn-ghost" type="button" onClick={acceptAll}>
                <Icon name="check" small />
                Accept all
              </button>
              {source === 'precomputed' && hasDesign && !busy ? (
                <button className="btn btn-ghost" type="button" onClick={props.onExtract}>
                  Try again
                </button>
              ) : null}
            </div>
          </div>
          {comparison ? (
            <ComparisonPanel comparison={comparison} onUseAi={props.onUseAi} onKeepVerified={props.onKeepVerified} />
          ) : null}
        </div>
      ) : null}

      {showEmpty ? (
        <section className="cband" aria-labelledby={`${ids}-nd`}>
          <div className="empty" style={{ paddingTop: 'var(--space-8)' }}>
            <h2 id={`${ids}-nd`}>No design image yet</h2>
            <p className="muted">
              A contract is built from the design. Add one to the project, then extract requirements here. You can also
              write requirements by hand.
            </p>
            <div className="btn-row">
              <button className="btn btn-primary" type="button" onClick={props.onAddDesign}>
                <Icon name="upload" small />
                Add a design image
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setAdding(true)}>
                <Icon name="plus" small />
                Add requirement
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {extracting ? (
        <section className="cband" aria-labelledby={`${ids}-x`}>
          <div className="extract-grid">
            <div className="stack">
              <h2
                id={`${ids}-x`}
                className="h3"
              >{`Extracting requirements from the ${extracting.viewportLabel} design`}</h2>
              <ol className="xstages">
                {extracting.stages.map((s) => (
                  <li key={s.label}>
                    {s.state === 'done' ? (
                      <Icon name="check" small />
                    ) : s.state === 'run' ? (
                      <span className="spinner" aria-hidden="true" />
                    ) : (
                      <Icon name="dash" small className="subtle" />
                    )}
                    <span className={s.state === 'wait' ? 'muted' : undefined}>{s.label}</span>
                    <span className="w">{s.detail}</span>
                    <div
                      className="bar"
                      role="progressbar"
                      aria-label={s.label}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={s.percent}
                    >
                      <span style={{ ['--p' as string]: `${s.percent}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
              <p className="row small muted">
                <EngineText engine={extracting.engine} />
                <span>
                  {extracting.engine === 'cloud'
                    ? 'Sent to Google Gemini through Firebase for this project.'
                    : 'Nothing is sent off this device.'}
                </span>
              </p>
              <p className="small muted">
                <Elapsed />
                {extracting.engine === 'cloud' ? '' : ' On-device can take a few minutes on some devices.'}
              </p>
              <div>
                <button className="btn btn-ghost" type="button" onClick={props.onStopExtract}>
                  Stop extracting
                </button>
              </div>
            </div>
            {designOf('desktop') ? (
              <figure className="fig">
                <figcaption>
                  <b>
                    <span className="legend" aria-hidden="true" />
                    {`Design, ${extracting.viewportLabel}`}
                  </b>
                </figcaption>
                <DesignCanvas
                  src={designSrc.desktop}
                  width={designOf('desktop')?.image.cssWidth ?? 1440}
                  height={cssHeight(project, 'desktop')}
                  label={`Design, ${extracting.viewportLabel}`}
                  requirements={[]}
                />
              </figure>
            ) : null}
          </div>
        </section>
      ) : null}

      {showSplit ? (
        <div className="split">
          <section className="split-list" aria-labelledby={`${ids}-rl`}>
            <div className="split-list-head" style={{ minHeight: 'var(--layout-target)' }}>
              <h2 id={`${ids}-rl`} className="small" style={{ fontWeight: 'var(--weight-medium)' }}>
                Requirements <span className="muted">{reqs.length}</span>
              </h2>
              {editable && !reviewing && unaccepted > 0 ? (
                <button className="btn btn-ghost" type="button" onClick={acceptAll}>
                  <Icon name="check" small />
                  Accept all
                </button>
              ) : (
                <span className="small muted">
                  {reviewing
                    ? source === 'precomputed'
                      ? 'Pre-computed extraction'
                      : `Extracted ${source === 'cloud' ? 'Cloud' : 'On-device'}`
                    : ''}
                </span>
              )}
            </div>
            <ul
              className="rows"
              // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: listbox on ul, as in the prototype
              role="listbox"
              aria-label="Requirements, grouped by viewport"
              tabIndex={0}
              aria-activedescendant={selected ? `o-${selected.id}` : undefined}
              onKeyDown={onListKey}
            >
              {groups.flatMap((v) => [
                <li key={`g-${v}`} role="presentation" className="group-label">
                  {`${VP_TEXT[v]} · ${group(v).length}${designOf(v) || v === 'desktop' ? '' : `, inferred from Desktop (no ${VP_NAME[v]} design)`}`}
                </li>,
                ...group(v).map((r) => (
                  <RequirementRow
                    key={r.id}
                    requirement={r}
                    selected={r.id === selected?.id}
                    badge={props.renderBadge?.(r)}
                    onSelect={() => select(r.id)}
                    onHighlight={(on) => setHl(on ? r.id : null)}
                  />
                )),
              ])}
            </ul>
          </section>
          <section className="split-detail" id="detail" aria-labelledby={`${ids}-dt`}>
            {selected ? (
              <Detail
                key={selected.id}
                r={selected}
                titleId={`${ids}-dt`}
                titleRef={detailTitle}
                project={project}
                designSrc={designSrc}
                reqs={reqs}
                hl={hl}
                editable={editable}
                locked={locked}
                editing={editing === selected.id}
                draftSt={draftSt}
                draftCond={draftCond}
                stErr={stErr}
                badge={props.renderBadge?.(selected)}
                onDraftSt={setDraftSt}
                onDraftCond={setDraftCond}
                onSelect={select}
                onEdit={() => startEdit(selected)}
                onCancelEdit={() => setEditing(null)}
                onSave={() => saveEdit(selected)}
                onAccept={() => cur && void run(() => service.accept(cur.id, [selected.id]))}
                onDelete={() => {
                  if (!cur) return;
                  const i = reqs.findIndex((x) => x.id === selected.id);
                  const nextId = (reqs[i + 1] ?? reqs[i - 1])?.id;
                  void run(
                    () => service.remove(cur.id, selected.id),
                    () => setSel(nextId),
                  );
                }}
              />
            ) : (
              <div className="empty">
                <h2 id={`${ids}-dt`}>No requirement selected</h2>
                <p className="muted">Pick a requirement from the list to see its region on the design.</p>
              </div>
            )}
          </section>
        </div>
      ) : null}
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      {adding ? (
        <RequirementEditor
          viewport="desktop"
          viewports={
            hasDesign
              ? designs.map((d) => d.viewport).concat(designs.some((d) => d.viewport === 'mobile') ? [] : ['mobile'])
              : ['desktop', 'mobile']
          }
          onSave={(d) => void addDraft(d)}
          onCancel={() => setAdding(false)}
        />
      ) : null}
    </main>
  );
};

function cssHeight(p: Project, v: ViewportId): number {
  const img = p.designs.find((d) => d.viewport === v)?.image;
  return img ? Math.round((img.height * img.cssWidth) / img.width) : 1000;
}

interface DetailProps {
  r: Requirement;
  titleId: string;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  project: Project;
  designSrc: Partial<Record<ViewportId, string>>;
  reqs: Requirement[];
  hl: string | null;
  editable: boolean;
  locked: boolean;
  editing: boolean;
  draftSt: string;
  draftCond: string;
  stErr: boolean;
  badge?: ReactNode;
  onDraftSt(v: string): void;
  onDraftCond(v: string): void;
  onSelect(id: string): void;
  onEdit(): void;
  onCancelEdit(): void;
  onSave(): void;
  onAccept(): void;
  onDelete(): void;
}

const Detail: FC<DetailProps> = (p) => {
  const { r } = p;
  const design = p.project.designs.find((d) => d.viewport === r.viewport);
  const status = p.locked ? (
    <span className="st">
      <Icon name="lock" />
      Locked by a Run
    </span>
  ) : r.accepted ? (
    <span className="st">
      <Icon name="check" />
      Accepted
    </span>
  ) : (
    <span className="st st-nc">
      <Icon name="dash" />
      Not accepted: not verified until accepted
    </span>
  );
  const edField = `${p.titleId}-st`;
  return (
    <>
      <figure className="fig">
        <figcaption>
          <b>
            <span className="legend" aria-hidden="true" />
            {design ? `Design, ${VP_NAME[r.viewport]}` : `${VP_NAME[r.viewport]} design missing`}
          </b>
          {design ? <span>{`${design.image.cssWidth} × ${cssHeight(p.project, r.viewport)}`}</span> : null}
        </figcaption>
        {design ? (
          <DesignCanvas
            src={p.designSrc[r.viewport]}
            width={design.image.cssWidth}
            height={cssHeight(p.project, r.viewport)}
            label={`Design, ${VP_NAME[r.viewport]} ${design.image.cssWidth} × ${cssHeight(p.project, r.viewport)}, ${
              regionDisplay(r).kind === 'none' ? 'no region' : `${r.id} highlighted`
            }`}
            requirements={p.reqs.filter((x) => x.viewport === r.viewport)}
            selectedId={r.id}
            highlightId={p.hl}
            onSelect={p.onSelect}
          />
        ) : (
          <div className="nodesign">
            <div className="stack-sm">
              <strong>{`No ${VP_NAME[r.viewport]} design`}</strong>
              <span>{`Inferred from the Desktop design. This check runs on the ${VP_NAME[r.viewport]} capture and its DOM snapshot.`}</span>
            </div>
          </div>
        )}
      </figure>
      <div className="stack">
        <div className="row" style={{ gap: 'var(--space-4)' }}>
          {status}
        </div>
        {p.editing ? (
          <>
            <h2 id={p.titleId} className="sr-only" ref={p.titleRef} tabIndex={-1}>{`Edit ${r.id}`}</h2>
            <div className="redit">
              <div className="field">
                <label htmlFor={edField}>Statement</label>
                <textarea
                  className="textarea"
                  id={edField}
                  rows={2}
                  maxLength={160}
                  style={{ minHeight: 0 }}
                  value={p.draftSt}
                  aria-invalid={p.stErr ? true : undefined}
                  aria-describedby={p.stErr ? `${edField}-err` : undefined}
                  onChange={(e) => p.onDraftSt(e.target.value)}
                />
                {p.stErr ? (
                  <p className="error" id={`${edField}-err`}>
                    <Icon name="alert" small />
                    The statement can’t be empty.
                  </p>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor={`${edField}-c`}>Passes when</label>
                <input
                  className="input"
                  id={`${edField}-c`}
                  maxLength={200}
                  value={p.draftCond}
                  onChange={(e) => p.onDraftCond(e.target.value)}
                />
              </div>
              <div className="btn-row">
                <button className="btn" type="button" onClick={p.onSave}>
                  Save
                </button>
                <button className="btn btn-ghost" type="button" onClick={p.onCancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          </>
        ) : (
          <h2 id={p.titleId} className="prose" ref={p.titleRef} tabIndex={-1}>
            {r.statement}
          </h2>
        )}
        <div className="meta">
          <span className="mono xs">{r.id}</span>
          <span>{VP_TEXT[r.viewport]}</span>
          <span>{CATEGORY_TEXT[r.category]}</span>
          <span>
            {r.label === 'inferred' ? <span className="tag tag-dashed">Inferred (advisory)</span> : 'Explicit'}
          </span>
          <span>{CHECK_TEXT[r.checkType]}</span>
          {p.badge}
        </div>
      </div>
      {p.editing ? null : (
        <section className="sec" aria-labelledby={`${p.titleId}-pw`}>
          <h3 id={`${p.titleId}-pw`}>Passes when</h3>
          <p className="prose">{r.condition}</p>
        </section>
      )}
      <dl className="kv">
        <dt>Region</dt>
        <dd>{regionText(r, design !== undefined)}</dd>
        <dt>Bounds</dt>
        <dd>{boundsText(r)}</dd>
        <dt>Checked by</dt>
        <dd>{CHECKED_BY[r.checkType]}</dd>
        {r.label === 'inferred' ? (
          <>
            <dt>Severity</dt>
            <dd>Capped at Minor (advisory)</dd>
          </>
        ) : null}
      </dl>
      {p.editable ? (
        <div className="btn-row">
          {r.accepted ? null : (
            <button className="btn btn-ghost" type="button" onClick={p.onAccept}>
              <Icon name="check" small />
              Accept
            </button>
          )}
          {p.editing ? null : (
            <button className="btn btn-ghost" type="button" onClick={p.onEdit}>
              <Icon name="edit" small />
              Edit
            </button>
          )}
          <button className="btn btn-ghost" type="button" onClick={p.onDelete}>
            <Icon name="trash" small />
            Delete
          </button>
        </div>
      ) : null}
    </>
  );
};

/** Sample comparison (SPEC-DEMO-03): counts only; the two choices are callbacks owned by `app`. */
const ComparisonPanel: FC<{
  comparison: Comparison;
  onUseAi?(): void;
  onKeepVerified?(): void;
}> = ({ comparison: c, onUseAi, onKeepVerified }) => {
  const id = useId();
  const proposed = c.matched.length + c.extra.length;
  const none = <span className="muted">None</span>;
  const items = (list: ComparisonItem[]) =>
    list.length === 0
      ? none
      : list.map((x) => (
          <div key={x.id}>
            <span className="mono xs">{x.id}</span>
            {x.statement ? ` ${x.statement}` : ''}
          </div>
        ));
  return (
    <section className="sec" aria-labelledby={`${id}-h`}>
      <div className="sec-head">
        <div className="stack-sm" style={{ gap: 'var(--space-1)' }}>
          <h2
            id={`${id}-h`}
            className="h3"
          >{`AI proposed ${plural(proposed, 'requirement', 'requirements')}; ${c.matched.length} match the verified contract`}</h2>
          <p className="small muted">A match has the same category and a region overlap (IoU) of 0.5 or more.</p>
        </div>
        <div className="btn-row">
          <button className="btn btn-ghost" type="button" onClick={onUseAi}>
            Use AI contract
          </button>
          <button className="btn btn-primary" type="button" onClick={onKeepVerified}>
            Keep verified contract
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data">
          <caption className="sr-only">AI contract compared with the verified sample contract</caption>
          <thead>
            <tr>
              <th>Result</th>
              <th className="r">Count</th>
              <th>Requirements</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Matched</td>
              <td className="r">{c.matched.length}</td>
              <td>
                {c.matched.length === 0
                  ? none
                  : c.matched.map((x) => <span key={x} className="mono xs">{`${x} `}</span>)}
              </td>
            </tr>
            <tr>
              <td>Missed by AI</td>
              <td className="r">{c.missing.length}</td>
              <td>{items(c.missing)}</td>
            </tr>
            <tr>
              <td>Extra from AI</td>
              <td className="r">{c.extra.length}</td>
              <td>{items(c.extra)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};
