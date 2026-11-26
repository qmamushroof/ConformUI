import { CuiError, type Project, type ViewportId } from '@kernel';
import { type FC, type FormEvent, type MouseEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ProjectSummary, ProjectsService } from '../types';
import { Icon } from './icon';
import { dateText, dateTimeText, plural, RELEASE_VIEWPORTS, viewportLabel } from './labels';
import { Sheet } from './sheet';
import { Toasts, useToast } from './toast';

/** Routed screen `/` (SPEC §4.13.2). `app` passes the service and navigation as callbacks (SPEC-ARCH-07). */
export interface ProjectsScreenProps {
  service: Pick<ProjectsService, 'list' | 'create' | 'remove' | 'rename'>;
  /** Opens a project (client-side navigation). `viewports` is set after New project. */
  onOpen(projectId: string, viewports?: ViewportId[]): void;
  /** Link target of "Try the sample". */
  sampleHref: string;
  /** Link target of a card; default `/p/<id>`. */
  projectHref?(projectId: string): string;
  /** Downloads the project's contract (SPEC-EXP-01); the menu item is disabled without a contract. */
  onExportContract?(projectId: string): void;
  /** Called by the storage error's Reload; default reloads the page. */
  onReload?(): void;
}

type Load = { kind: 'loading' } | { kind: 'ready'; list: ProjectSummary[] } | { kind: 'error'; code: string };
type SheetState =
  | { kind: 'new' }
  | { kind: 'rename'; item: ProjectSummary }
  | { kind: 'delete'; item: ProjectSummary }
  | undefined;

const RUN_LABELS = [
  ['fail', 'fail', 'x', 'st-fail'],
  ['review', 'needs review', 'review', 'st-review'],
  ['pass', 'pass', 'check', 'st-pass'],
] as const;

const line = (id: string, w: number, h?: number) => ({ id, w, h });
const SKELETONS = [
  [line('a1', 60, 16), line('a2', 45), line('a3', 70), line('a4', 55)],
  [line('b1', 50, 16), line('b2', 35), line('b3', 65), line('b4', 40)],
  [line('c1', 55, 16), line('c2', 45), line('c3', 60), line('c4', 30)],
];

const STEPS = ['Contract', 'Run', 'Fix prompt', 'Re-verify'] as const;

export const ProjectsScreen: FC<ProjectsScreenProps> = ({
  service,
  onOpen,
  sampleHref,
  projectHref,
  onExportContract,
  onReload,
}) => {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [sheet, setSheet] = useState<SheetState>();
  const [menu, setMenu] = useState<string>();
  const [toast, say] = useToast();
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const list = await service.list();
      if (alive.current) setLoad({ kind: 'ready', list });
    } catch (e) {
      if (alive.current) setLoad({ kind: 'error', code: e instanceof CuiError ? e.code : 'STORAGE_FAILED' });
    }
  }, [service]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e instanceof Event && !(e instanceof KeyboardEvent) && (e.target as Element | null)?.closest('.menu-wrap'))
        return;
      setMenu(undefined);
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);

  const href = (id: string) => (projectHref ? projectHref(id) : `/p/${id}`);
  const open = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen(id);
  };

  const list = load.kind === 'ready' ? load.list : [];
  const empty = load.kind === 'ready' && list.length === 0;
  const showActions = load.kind === 'loading' || (load.kind === 'ready' && !empty);

  return (
    <main id="main" tabIndex={-1} className="page">
      <div className="page-head">
        <div className="stack-sm">
          <h1>Projects</h1>
          {load.kind === 'ready' && !empty ? (
            <p className="small muted">{plural(list.length, 'project')}, stored on this device</p>
          ) : null}
        </div>
        {showActions ? (
          <div className="btn-row">
            <a className="btn btn-ghost" href={sampleHref}>
              <Icon name="play" small />
              Try the sample
            </a>
            <button className="btn btn-primary" type="button" onClick={() => setSheet({ kind: 'new' })}>
              <Icon name="plus" small />
              New project
            </button>
          </div>
        ) : null}
      </div>

      {load.kind === 'loading' ? (
        <section aria-busy="true" aria-label="Loading projects">
          <p className="sr-only" role="status">
            Loading projects
          </p>
          <div className="cards" aria-hidden="true">
            {SKELETONS.map((card) => (
              <div className="skel-card" key={card[0]?.id}>
                {card.map((l) => (
                  <div key={l.id} className="skel skel-line" style={{ width: `${l.w}%`, height: l.h }} />
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {load.kind === 'error' ? (
        <section className="prose">
          <div className="notice notice-danger" role="alert">
            <Icon name="alert" />
            <p className="title">Couldn't open local storage. Nothing was deleted.</p>
            <p className="small muted">
              The browser blocked access to this site's data, which can happen in private windows or when storage is
              full. Reload to try again.
            </p>
            <p className="xs muted">
              Code <span className="mono">{load.code}</span>
            </p>
            <div className="btn-row">
              <button className="btn" type="button" onClick={() => (onReload ? onReload() : window.location.reload())}>
                <Icon name="refresh" small />
                Reload
              </button>
              <a className="btn btn-ghost" href="/settings#data">
                Check storage in Settings
              </a>
            </div>
          </div>
        </section>
      ) : null}

      {empty ? (
        <section className="empty" aria-labelledby="empty-h">
          <h2 id="empty-h">No projects yet</h2>
          <p className="muted">
            Check a page against its design: build a contract, run it, hand the fixes to your coding agent.
          </p>
          <ol className="loopline" aria-label="How it works">
            {STEPS.map((s, i) => (
              <li key={s}>
                <span className="n" aria-hidden="true">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <div className="btn-row">
            <a className="btn btn-primary" href={sampleHref}>
              <Icon name="play" small />
              Try the sample
            </a>
            <button className="btn btn-ghost" type="button" onClick={() => setSheet({ kind: 'new' })}>
              <Icon name="plus" small />
              New project
            </button>
          </div>
          <p className="small muted">
            The sample is a landing page with a design, two captures and a contract ready to run.
          </p>
        </section>
      ) : null}

      {load.kind === 'ready' && !empty ? (
        <section aria-label="Your projects">
          {/* biome-ignore lint/a11y/noRedundantRoles: list-style none drops list semantics in Safari, so the role is kept */}
          <ul className="cards" role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {list.map((p) => (
              <ProjectCard
                key={p.id}
                item={p}
                href={href(p.id)}
                menuOpen={menu === p.id}
                onToggleMenu={() => setMenu(menu === p.id ? undefined : p.id)}
                onOpen={(e) => open(e, p.id)}
                onRename={() => {
                  setMenu(undefined);
                  setSheet({ kind: 'rename', item: p });
                }}
                onExport={() => {
                  setMenu(undefined);
                  onExportContract?.(p.id);
                }}
                onDelete={() => {
                  setMenu(undefined);
                  setSheet({ kind: 'delete', item: p });
                }}
              />
            ))}
          </ul>
          <p className="small muted foot-note">
            <Icon name="shield" small /> Designs, captures, contracts and runs stay in this browser.{' '}
            <a href="/settings#privacy">Privacy and data</a>
          </p>
        </section>
      ) : null}

      {sheet?.kind === 'new' ? (
        <NewProjectSheet
          onClose={() => setSheet(undefined)}
          onCreate={async (name, viewports) => {
            const p: Project = await service.create(name);
            setSheet(undefined);
            onOpen(p.id, viewports);
          }}
        />
      ) : null}
      {sheet?.kind === 'rename' ? (
        <RenameSheet
          item={sheet.item}
          onClose={() => setSheet(undefined)}
          onSave={async (name) => {
            await service.rename(sheet.item.id, name);
            setSheet(undefined);
            await refresh();
            say(`Renamed to ${name}`);
          }}
        />
      ) : null}
      {sheet?.kind === 'delete' ? (
        <DeleteSheet
          item={sheet.item}
          onClose={() => setSheet(undefined)}
          onDelete={async () => {
            await service.remove(sheet.item.id);
            setSheet(undefined);
            await refresh();
            document.getElementById('main')?.focus();
            say(`Deleted ${sheet.item.name}`);
          }}
        />
      ) : null}
      <Toasts message={toast} />
    </main>
  );
};

const ProjectCard: FC<{
  item: ProjectSummary;
  href: string;
  menuOpen: boolean;
  onToggleMenu(): void;
  onOpen(e: MouseEvent<HTMLAnchorElement>): void;
  onRename(): void;
  onExport(): void;
  onDelete(): void;
}> = ({ item, href, menuOpen, onToggleMenu, onOpen, onRename, onExport, onDelete }) => {
  const missing = RELEASE_VIEWPORTS.filter((v) => !item.viewports.includes(v));
  const last = item.lastRun;
  const counts = last
    ? RUN_LABELS.filter(([k]) => last[k] > 0).map(([k, word, icon, cls]) => ({ k, n: last[k], word, icon, cls }))
    : [];
  const countLabel = `Last run: ${counts.map((c) => `${c.n} ${c.word}`).join(', ')}`;
  return (
    <li className="pcard">
      <a className="card" href={href} onClick={onOpen}>
        <div className="title-row">
          <h2 className="h3">{item.name}</h2>
          {item.isSample ? <span className="tag">Sample</span> : null}
        </div>
        <div className="meta">
          {item.viewports.length === 0 ? <span>No design or capture yet</span> : null}
          {RELEASE_VIEWPORTS.filter((v) => item.viewports.includes(v)).map((v) => (
            <span key={v}>{viewportLabel(v)}</span>
          ))}
          {item.viewports.length > 0 && missing.length > 0
            ? missing.map((v) => <span key={v}>No {viewportLabel(v).split(' ')[0]} capture</span>)
            : null}
        </div>
        <div className="meta">
          {last ? (
            <span>Last run {dateTimeText(last.at)}</span>
          ) : (
            <>
              <span>No runs yet</span>
              {item.createdAt !== undefined ? <span>Created {dateText(item.createdAt)}</span> : null}
            </>
          )}
        </div>
        {counts.length > 0 ? (
          // biome-ignore lint/a11y/useSemanticElements: a labelled group of status words, not a form fieldset
          <div className="counts" role="group" aria-label={countLabel}>
            {counts.map((c) => (
              <span key={c.k} className={`st ${c.cls}`}>
                <Icon name={c.icon} />
                {c.n} {c.word}
              </span>
            ))}
          </div>
        ) : null}
        {!last && item.hasContract === false ? (
          <p className="st st-nc">
            <Icon name="dash" />
            Contract not extracted
          </p>
        ) : null}
      </a>
      <div className="menu-wrap">
        <button
          className="iconbtn"
          type="button"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          aria-label={`More actions for ${item.name}`}
          onClick={onToggleMenu}
        >
          <Icon name="more" />
        </button>
        <div className="menu" hidden={!menuOpen}>
          <button type="button" onClick={onRename}>
            <Icon name="edit" small />
            Rename
          </button>
          {item.hasContract === false ? (
            <button type="button" aria-disabled="true">
              <Icon name="download" small />
              Export contract: none yet
            </button>
          ) : (
            <button type="button" onClick={onExport}>
              <Icon name="download" small />
              Export contract
            </button>
          )}
          <button type="button" onClick={onDelete}>
            <Icon name="trash" small />
            Delete…
          </button>
        </div>
      </div>
    </li>
  );
};

const NewProjectSheet: FC<{
  onClose(): void;
  onCreate(name: string, viewports: ViewportId[]): Promise<void>;
}> = ({ onClose, onCreate }) => {
  const ids = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [vps, setVps] = useState<ViewportId[]>(['desktop', 'mobile']);
  const [noName, setNoName] = useState(false);
  const [noVp, setNoVp] = useState(false);
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const bad = !name.trim();
    const none = vps.length === 0;
    setNoName(bad);
    setNoVp(none);
    if (bad || none) return;
    setBusy(true);
    try {
      await onCreate(name.trim(), vps);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'The project was not created.');
      setBusy(false);
    }
  };

  return (
    <Sheet labelledBy={`${ids}-h`} onClose={onClose} initialFocus={nameRef}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-head">
          <div className="stack-sm">
            <h2 id={`${ids}-h`}>New project</h2>
            <p className="muted small">One page, checked at the viewports you pick. You add the design next.</p>
          </div>
          <button className="iconbtn" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="field">
          <label htmlFor={`${ids}-name`}>Project name</label>
          <input
            ref={nameRef}
            className="input"
            id={`${ids}-name`}
            autoComplete="off"
            placeholder="Checkout page"
            value={name}
            aria-invalid={noName ? 'true' : undefined}
            aria-describedby={`${ids}-name-err`}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNoName(false);
            }}
          />
          <p className="error" id={`${ids}-name-err`} hidden={!noName}>
            <Icon name="alert" small />
            Give the project a name
          </p>
        </div>
        <fieldset aria-describedby={`${ids}-vp-err`}>
          <legend className="label">Viewports</legend>
          {RELEASE_VIEWPORTS.map((v) => (
            <label className="choice" key={v}>
              <input
                type="checkbox"
                checked={vps.includes(v)}
                onChange={(e) => {
                  const next = e.target.checked ? [...vps, v] : vps.filter((x) => x !== v);
                  setVps(RELEASE_VIEWPORTS.filter((x) => next.includes(x)));
                  if (next.length) setNoVp(false);
                }}
              />
              <span>{viewportLabel(v)}</span>
            </label>
          ))}
          <label className="choice" style={{ cursor: 'not-allowed' }}>
            <input type="checkbox" disabled aria-describedby={`${ids}-tab`} />
            <span className="muted">Tablet 768</span>
            <span className="help" id={`${ids}-tab`}>
              Coming later
            </span>
          </label>
          <p className="error" id={`${ids}-vp-err`} hidden={!noVp}>
            <Icon name="alert" small />
            Pick at least one viewport
          </p>
        </fieldset>
        {failed ? (
          <p className="error" role="alert">
            <Icon name="alert" small />
            {failed}
          </p>
        ) : null}
        <div className="sheet-foot">
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Create project
          </button>
        </div>
      </form>
    </Sheet>
  );
};

const RenameSheet: FC<{ item: ProjectSummary; onClose(): void; onSave(name: string): Promise<void> }> = ({
  item,
  onClose,
  onSave,
}) => {
  const ids = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(item.name);
  const [bad, setBad] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = name.trim();
    setBad(!v);
    if (v) await onSave(v);
  };
  useEffect(() => ref.current?.select(), []);
  return (
    <Sheet labelledBy={`${ids}-h`} onClose={onClose} initialFocus={ref}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-head">
          <h2 id={`${ids}-h`}>Rename project</h2>
          <button className="iconbtn" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="field">
          <label htmlFor={`${ids}-name`}>Project name</label>
          <input
            ref={ref}
            className="input"
            id={`${ids}-name`}
            autoComplete="off"
            value={name}
            aria-invalid={bad ? 'true' : undefined}
            aria-describedby={`${ids}-err`}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setBad(false);
            }}
          />
          <p className="error" id={`${ids}-err`} hidden={!bad}>
            <Icon name="alert" small />
            Give the project a name
          </p>
        </div>
        <div className="sheet-foot">
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            Save name
          </button>
        </div>
      </form>
    </Sheet>
  );
};

const DeleteSheet: FC<{ item: ProjectSummary; onClose(): void; onDelete(): Promise<void> }> = ({
  item,
  onClose,
  onDelete,
}) => {
  const ids = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState('');
  const ok = typed.trim() === item.name;
  return (
    <Sheet labelledBy={`${ids}-h`} onClose={onClose} initialFocus={cancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) void onDelete();
        }}
      >
        <div className="sheet-head">
          <h2 id={`${ids}-h`}>Delete project “{item.name}”?</h2>
          <button className="iconbtn" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <p className="small">
          Its designs, captures, contract and <span>{plural(item.runCount ?? 0, 'run')}</span> are removed from this
          device. This can't be undone.
        </p>
        <div className="field">
          <label htmlFor={`${ids}-confirm`}>
            Type <b>{item.name}</b> to confirm
          </label>
          <input
            className="input"
            id={`${ids}-confirm`}
            autoComplete="off"
            spellCheck={false}
            value={typed}
            aria-describedby={`${ids}-help`}
            onChange={(e) => setTyped(e.target.value)}
          />
          <p className="help" id={`${ids}-help`}>
            The Delete button turns on when the name matches.
          </p>
        </div>
        <div className="sheet-foot">
          <button ref={cancel} className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            type="submit"
            aria-disabled={ok ? 'false' : 'true'}
            aria-describedby={`${ids}-help`}
          >
            <Icon name="trash" small />
            Delete project
          </button>
        </div>
      </form>
    </Sheet>
  );
};
