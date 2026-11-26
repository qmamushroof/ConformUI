import type { Contract, EngineStatus, Project, Run, RunSummary } from '@kernel';
import { ProjectHead, ProjectInputs, staleViewports } from '@projects';
import { RunHistory } from '@run';
import { EnginePanel, type EngineView } from '@settings';
import { SnapshotPasteField } from '@snippet';
import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { copy } from '../copy';
import { useBlobUrls } from '../flows/blob-urls';
import { downloadText, MIME } from '../flows/files';
import { stepper } from '../flows/helpers';
import { CloseButton, Glyph, Sheet, Toasts, useToast } from '../flows/ui';
import { enginePill } from '../hooks';
import { NotFound } from '../not-found';
import { useServices } from '../services';

interface Data {
  project: Project;
  contract?: Contract;
  runs: Run[];
  history: RunSummary[];
  status: EngineStatus;
  view: EngineView;
}

type Load = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; data: Data };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const dateText = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ICONS = {
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  cloud: 'M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 18z',
  ruler: 'M2 8h20v8H2zM6 8v3M10 8v4M14 8v3M18 8v4',
  play: 'M7 4l13 8-13 8z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  close: 'M6 6l12 12M18 6L6 18',
} as const;

const PILL = {
  onDevice: { icon: ICONS.chip, text: copy.header.engine.onDevice, note: 'First pass stays on this device.' },
  cloud: { icon: ICONS.cloud, text: copy.header.engine.cloud, note: 'You approve what is sent, per project.' },
  measured: {
    icon: ICONS.ruler,
    text: copy.header.engine.measured,
    note: 'Measured and Visual checks run on this device.',
  },
} as const;

const VP_TEXT = { desktop: 'Desktop 1440', mobile: 'Mobile 390', tablet: 'Tablet 768' } as const;

/** `/p/:projectId` (SPEC-PROJ-*): inputs per viewport, contract summary, engine, run history and the next action. */
const ProjectRoute: FC = () => {
  const { projectId = '' } = useParams();
  const sv = useServices();
  const { projects, store, blobs, settings, ai, run: runs, contract: contracts } = sv;
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [version, setVersion] = useState(0);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dlError, setDlError] = useState<string>();
  const [toast, say] = useToast();
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads after a change.
  useEffect(() => {
    let live = true;
    (async () => {
      const project = await projects.get(projectId);
      if (!project) return live && setLoad({ kind: 'missing' });
      const [contract, allRuns, history, status, view] = await Promise.all([
        contracts.active(projectId),
        store.listRuns(projectId),
        runs.history(projectId),
        ai.status(),
        settings.engine(),
      ]);
      const data: Data = {
        project,
        runs: [...allRuns].sort((a, b) => b.createdAt - a.createdAt),
        history,
        status,
        view,
        ...(contract && { contract }),
      };
      if (live) setLoad({ kind: 'ready', data });
    })().catch(() => live && setLoad({ kind: 'missing' }));
    return () => {
      live = false;
    };
  }, [projectId, projects, contracts, store, runs, ai, settings, version]);

  const project = load.kind === 'ready' ? load.data.project : undefined;
  const urls = useBlobUrls(blobs, project ? [...project.designs, ...project.captures].map((x) => x.image.blobId) : []);
  useEffect(() => sv.onEngineChange(refresh), [sv, refresh]);

  if (load.kind === 'loading') return <main id="main" tabIndex={-1} className="page" aria-busy="true" />;
  if (load.kind === 'missing') return <NotFound />;
  const { project: p, contract, runs: allRuns, history, status, view } = load.data;
  const latest = allRuns[0];
  const { done, next } = stepper(p, allRuns.length);
  const pill = PILL[enginePill(status, view.mode)];
  const explicit = contract?.requirements.filter((r) => r.label === 'explicit').length ?? 0;
  const inferred = (contract?.requirements.length ?? 0) - explicit;
  const vps = [...new Set([...p.designs, ...p.captures].map((x) => x.viewport))];
  const vpText = (vps.length > 0 ? vps : (['desktop', 'mobile'] as const)).map((v) => VP_TEXT[v]).join(' and ');
  const latestOpen = latest
    ? latest.results.filter((r) => r.status === 'fail' || r.status === 'needs-review').length
    : 0;
  const hrefs = latest
    ? {
        run: `/p/${p.id}/run/${latest.id}`,
        fix: `/p/${p.id}/run/${latest.id}`,
        reverify: `/p/${p.id}/run/${latest.id}?reverify=1`,
      }
    : undefined;
  const showEngine = view.device === 'downloadable' || view.device === 'downloading' || Boolean(view.enableSteps);
  const privacy = settings.privacy(p);

  const exportContract = async () => {
    setMenu(false);
    if (!contract) return;
    const exp = await import('@export');
    const name = exp.fileName('contract', p, 'md', sv.clock.now());
    downloadText(name, exp.contractMarkdown(contract, p), MIME.md);
    say(copy.flows.downloaded(name));
  };

  const remove = async () => {
    await projects.remove(p.id);
    navigate('/');
  };

  const needsContract = p.designs.length > 0 && !contract;
  const canRun = Boolean(contract) && p.captures.length > 0;

  return (
    <>
      <ProjectHead project={p} step="captures" done={done} next={next} {...(hrefs && { hrefs })} />
      <main id="main" tabIndex={-1} className="page">
        <div className="page-head">
          <div className="stack-sm">
            <h1>{p.name}</h1>
            <div className="meta">
              <span>{vpText}</span>
              <span>{latest ? `Last run ${dateText(latest.createdAt)}` : `Created ${dateText(p.createdAt)}`}</span>
              {latest && latestOpen > 0 ? (
                <span>{latest.changes ? `${latestOpen} remaining` : `${latestOpen} to fix`}</span>
              ) : null}
              {!latest && contract ? <span>No runs yet</span> : null}
            </div>
          </div>
          <div className="btn-row">
            <div className="menu-wrap">
              <button
                className="iconbtn"
                type="button"
                aria-haspopup="true"
                aria-expanded={menu}
                aria-label="More project actions"
                onClick={() => setMenu((m) => !m)}
                onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}
              >
                <Glyph d={ICONS.more} />
              </button>
              <div className="menu" hidden={!menu}>
                <button type="button" aria-disabled="true" aria-describedby="rename-why">
                  <Glyph d={ICONS.edit} small />
                  Rename
                  <span className="muted xs" id="rename-why">
                    &nbsp;(coming later)
                  </span>
                </button>
                {contract ? (
                  <button type="button" onClick={() => void exportContract()}>
                    <Glyph d={ICONS.download} small />
                    Export contract
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setConfirmDelete(true);
                  }}
                >
                  <Glyph d={ICONS.trash} small />
                  Delete project
                </button>
              </div>
            </div>
            {needsContract ? (
              <Link className="btn btn-primary" to={`/p/${p.id}/contract`}>
                <Glyph d={ICONS.file} small />
                Extract contract
              </Link>
            ) : latest ? (
              <Link className="btn btn-primary" to={`/p/${p.id}/run/${latest.id}?reverify=1`}>
                <Glyph d={ICONS.refresh} small />
                Re-verify
              </Link>
            ) : contract ? (
              <button
                className="btn btn-primary"
                type="button"
                aria-disabled={canRun ? undefined : true}
                onClick={() => canRun && navigate(`/p/${p.id}/run/new`)}
              >
                <Glyph d={ICONS.play} small />
                Run
              </button>
            ) : null}
          </div>
        </div>
        {contract && !canRun && !latest ? <p className="small muted">{copy.flows.project.needCapture}</p> : null}
        {dlError ? (
          <div className="notice notice-danger" role="alert">
            <p className="title">{dlError}</p>
          </div>
        ) : null}

        <section className="facts" aria-label="Project status">
          <dl className="kv">
            <dt>Contract</dt>
            <dd>
              {contract ? (
                <>
                  <Link className="tlink" to={`/p/${p.id}/contract`}>
                    {`Contract v${contract.version}${contract.locked ? ', locked' : ''}`}
                  </Link>
                  <span className="muted">{`${contract.requirements.length} requirements (${explicit} explicit, ${inferred} inferred)`}</span>
                </>
              ) : p.designs.length > 0 ? (
                'Not extracted yet. Extraction reads the Desktop design on this device.'
              ) : (
                <span className="muted">No contract yet. Add a Desktop design to extract one.</span>
              )}
            </dd>
            <dt>Engine</dt>
            <dd>
              <span className="eng" role="img" aria-label={`Engine: ${pill.text}`}>
                <Glyph d={pill.icon} />
                {pill.text}
              </span>
              <span className="muted">{pill.note}</span>
              <Link className="tlink" to="/settings#engine">
                Engine settings
              </Link>
            </dd>
            <dt>Cloud</dt>
            <dd>{privacy.text}</dd>
          </dl>
        </section>

        {showEngine ? <EngineSection status={status} mode={view.mode} onDone={refresh} onError={setDlError} /> : null}

        <ProjectInputs
          project={p}
          service={projects}
          stale={staleViewports(p, latest)}
          imageSrc={(id) => urls[id]}
          snapshotField={(a) => <SnapshotPasteField {...a} />}
          onChange={refresh}
        />

        <section className="stack" style={{ marginTop: 'var(--space-12)' }} aria-labelledby="runs-h">
          <h2 id="runs-h">Runs</h2>
          {history.length > 0 ? (
            <RunHistory runs={history} onOpen={(id) => navigate(`/p/${p.id}/run/${id}`)} />
          ) : (
            <p className="muted small">
              {contract
                ? copy.flows.project.noRuns(contract.requirements.filter((r) => r.accepted).length)
                : copy.flows.project.noRunsEarly}
            </p>
          )}
        </section>
        <Toasts message={toast} />
      </main>
      {confirmDelete ? (
        <DeleteDialog name={p.name} onCancel={() => setConfirmDelete(false)} onDelete={() => void remove()} />
      ) : null}
    </>
  );
};

/** Compact engine panel with Download and the image-input steps (SPEC-SET-02, SPEC-SET-03). */
const EngineSection: FC<{
  status: EngineStatus;
  mode: EngineView['mode'];
  onDone(): void;
  onError(message: string | undefined): void;
}> = ({ status, mode, onDone, onError }) => {
  const { settings } = useServices();
  const [live, setLive] = useState(status);
  const [error, setError] = useState<string>();
  useEffect(() => setLive(status), [status]);
  const download = () => {
    setError(undefined);
    onError(undefined);
    setLive((s) => ({ ...s, device: 'downloading', downloadProgress: 0 }));
    settings
      .downloadModel((pr) => setLive((s) => ({ ...s, device: 'downloading', downloadProgress: pr })))
      .then(onDone)
      .catch(() => {
        setError('The model could not be downloaded. Try again later.');
        setLive(status);
      });
  };
  return (
    <section className="stack" style={{ marginBottom: 'var(--space-10)' }} aria-label="On-device engine">
      <EnginePanel status={live} mode={mode} onDownload={download} {...(error && { error })} />
    </section>
  );
};

const DeleteDialog: FC<{ name: string; onCancel(): void; onDelete(): void }> = ({ name, onCancel, onDelete }) => {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Sheet labelledBy="del-h" onClose={onCancel} initialFocus={cancel}>
      <div className="sheet-head">
        <div className="stack-sm">
          <h2 id="del-h">{`Delete ${name}?`}</h2>
          <p className="muted small">
            This removes the design, captures, DOM snapshots, contract and runs from this device. It can't be undone.
          </p>
        </div>
        <CloseButton onClick={onCancel} />
      </div>
      <div className="sheet-foot">
        <button className="btn" type="button" ref={cancel} onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-danger" type="button" onClick={onDelete}>
          <Glyph d={ICONS.trash} small />
          Delete project
        </button>
      </div>
    </Sheet>
  );
};

export default ProjectRoute;
