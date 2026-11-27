import { DeepAnalysisButton, DeepConfirmSheet, type DeepPreview } from '@deep';
import { LoadFixedButton, SampleBanner } from '@demo';
import { fixPrompt as buildFixPrompt, fileName, reportJson, reportMarkdown } from '@export';
import {
  type ConsentToken,
  type Contract,
  type ImageRef,
  mintConsent,
  type Project,
  type Run,
  type RunSummary,
  type SendList,
  type TraceStep,
  type ViewportId,
} from '@kernel';
import { ProjectHead } from '@projects';
import { type EvidenceImage, RunScreen, type RunScreenProps } from '@run';
import { type FC, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { copy } from '../copy';
import { useBlobUrls } from '../flows/blob-urls';
import { useConsentPrompt } from '../flows/consent';
import { copyToClipboard, downloadText, MIME } from '../flows/files';
import { type ErrorView, errorView, stepper } from '../flows/helpers';
import { loadFixedImplementation } from '../flows/sample';
import { CloseButton, Glyph, ManualCopySheet, Sheet, Toasts, useToast } from '../flows/ui';
import { recordCloudStep } from '../flows/usage';
import { NotFound } from '../not-found';
import { useServices } from '../services';
import { RunStarting } from './run-starting';

type Progress = NonNullable<RunScreenProps['progress']>;

interface Data {
  project: Project;
  contract?: Contract;
  run?: Run;
  history: RunSummary[];
  deepReason?: string;
}

type Load = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; data: Data };

const VPS: ViewportId[] = ['desktop', 'mobile'];
const VP_NAME: Record<ViewportId, string> = { desktop: 'Desktop 1440', mobile: 'Mobile 390', tablet: 'Tablet 768' };
const REFRESH = 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5';

/** CSS-pixel size of a stored image, which is what the evidence crops are measured in. */
const evidence = (src: string, ref: ImageRef): EvidenceImage => ({
  src,
  width: ref.cssWidth,
  height: Math.round((ref.height * ref.cssWidth) / ref.width),
});

/** Findings the cloud changed: a result whose status, confidence or finding differs after the merge. */
function refinedCount(before: Run, after: Run): number {
  const was = new Map(before.results.map((r) => [r.requirementId, JSON.stringify(r)]));
  return after.results.filter((r) => was.get(r.requirementId) !== JSON.stringify(r)).length;
}

/**
 * `/p/:projectId/run/:runId` (SPEC-RUN-*). `runId` `new` starts a Run on arrival and replaces itself with the stored
 * Run's id when it ends. Wires Deep Analysis (SPEC-DEEP-01), Re-verify (SPEC-RUN-09), the sample fallbacks
 * (SPEC-DEMO-05, SPEC-RUN-13), exports and usage recording (SPEC-APP-01).
 */
const RunRoute: FC = () => {
  const { projectId = '', runId = '' } = useParams();
  const sv = useServices();
  const { projects, store, blobs, settingsStore, ai, run: runs, deep, contract: contracts, sample } = sv;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const starting = runId === 'new';
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<ErrorView & { precomputedDeep?: boolean }>();
  const [progress, setProgress] = useState<{ steps: TraceStep[]; waiting: boolean } | undefined>(
    starting ? { steps: [], waiting: false } : undefined,
  );
  const [preview, setPreview] = useState<DeepPreview>();
  const [manual, setManual] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [deepBusy, setDeepBusy] = useState(false);
  const deepRunning = useRef(false);
  const [deepDone, setDeepDone] = useState<number>();
  const [toast, say] = useToast();
  const abort = useRef<AbortController | undefined>(undefined);
  const started = useRef(false);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const project = load.kind === 'ready' ? load.data.project : undefined;
  const consent = useConsentPrompt(sv, project);
  const reverify = params.get('reverify') === '1';

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads after a change.
  useEffect(() => {
    let live = true;
    (async () => {
      const p = await projects.get(projectId);
      if (!p) return live && setLoad({ kind: 'missing' });
      const history = await runs.history(projectId);
      const active = await contracts.active(projectId);
      if (starting) {
        return live && setLoad({ kind: 'ready', data: { project: p, history, ...(active && { contract: active }) } });
      }
      const r = await runs.get(runId);
      if (!r || r.projectId !== projectId) return live && setLoad({ kind: 'ready', data: { project: p, history } });
      const c = await store.getContract(r.contractId);
      const status = await ai.status();
      const avail = await deep.availability(r, status);
      const data: Data = {
        project: p,
        run: r,
        history,
        ...(c && { contract: c }),
        ...(!avail.ok && { deepReason: copy.deepReason[avail.reason] }),
      };
      if (live) setLoad({ kind: 'ready', data });
    })().catch(() => live && setLoad({ kind: 'missing' }));
    return () => {
      live = false;
    };
  }, [projectId, runId, starting, projects, runs, contracts, store, deep, ai, version]);

  const urls = useBlobUrls(blobs, project ? [...project.designs, ...project.captures].map((x) => x.image.blobId) : []);

  // A Run started by the project page (`/run/new`): once per visit (StrictMode mounts effects twice).
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on arrival only.
  useEffect(() => {
    if (!starting || started.current || !project) return;
    started.current = true;
    const ctl = new AbortController();
    abort.current = ctl;
    setProgress({ steps: [], waiting: false });
    (async () => {
      const [settings, status] = await Promise.all([settingsStore.read(), ai.status()]);
      const fresh = (await projects.get(projectId)) ?? project;
      const projectConsent = sv.consents.get(fresh);
      const precomputed = fresh.isSample ? (await sample()).precomputed : undefined;
      const done = await runs.start(
        projectId,
        { settings, status, ...(projectConsent && { projectConsent }), ...(precomputed && { precomputed }) },
        (e) => {
          if (e.kind === 'stage') {
            void recordCloudStep(sv, projectId, e.step);
            setProgress((p) => ({ steps: [...(p?.steps ?? []), e.step], waiting: false }));
            return;
          }
          setProgress((p) => ({ steps: p?.steps ?? [], waiting: true }));
          void consent.request(e.sends, copy.flows.consent.run).then((token) => {
            setProgress((p) => ({ steps: p?.steps ?? [], waiting: false }));
            e.resume(token);
          });
        },
        ctl.signal,
      );
      navigate(`/p/${projectId}/run/${done.id}`, { replace: true });
    })().catch((e: unknown) => {
      setProgress(undefined);
      setError(errorView(e));
    });
  }, [starting, project]);

  // The notices sit at the top of the page: bring a new one into view when the person triggered it from further down.
  const noticeKey = deepBusy ? 'busy' : error ? 'error' : deepDone !== undefined ? 'done' : '';
  useEffect(() => {
    if (!noticeKey) return;
    const id = requestAnimationFrame(() => {
      const sel = noticeKey === 'error' ? '[role="alert"].notice' : '.notice[role="status"]';
      document.querySelector(sel)?.scrollIntoView?.({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(id);
  }, [noticeKey]);

  if (load.kind === 'loading')
    return starting ? <RunStarting /> : <main id="main" tabIndex={-1} className="page" aria-busy="true" />;
  if (load.kind === 'missing') return <NotFound />;
  const { project: p, contract, run, history, deepReason } = load.data;
  const { done, next } = stepper(p, history.length);
  const number = run ? history.length - history.findIndex((h) => h.id === run.id) : undefined;
  const crumb = number ? `Run ${number}` : 'Run';
  const findings = run ? runs.findings(run) : [];
  const summary = run ? runs.summary(run) : { pass: 0, fail: 0, review: 0, notChecked: 0, line: '' };
  const fixText = run && contract ? buildFixPrompt({ project: p, contract, run, findings }) : undefined;

  const images: NonNullable<RunScreenProps['images']> = { design: {}, capture: {} };
  for (const vp of VPS) {
    const d = p.designs.find((x) => x.viewport === vp);
    const dsrc = d && urls[d.image.blobId];
    if (d && dsrc && images.design) images.design[vp] = evidence(dsrc, d.image);
    const c = p.captures.find((x) => x.viewport === vp && run?.captureIds.includes(x.id));
    const csrc = c && urls[c.image.blobId];
    if (c && csrc && images.capture) images.capture[vp] = evidence(csrc, c.image);
  }

  const copyText = async (text: string, toastText: string) => {
    if (await copyToClipboard(text)) say(toastText);
    else setManual(text);
  };

  const copyFix = () => {
    if (fixText === undefined) return;
    const fixes = findings.filter((f) => f.status === 'fail').length;
    const verify = findings.filter((f) => f.status === 'needs-review').length;
    void copyText(fixText, `Fix prompt copied: ${fixes} ${fixes === 1 ? 'fix' : 'fixes'}, ${verify} to verify first`);
  };

  const exportReport = (format: 'md' | 'json', action: 'copy' | 'download') => {
    if (!run || !contract) return;
    const input = { project: p, contract, run, findings };
    const body = format === 'md' ? reportMarkdown(input) : `${JSON.stringify(reportJson(input), null, 2)}\n`;
    if (action === 'copy') return void copyText(body, copy.flows.copied.text);
    const name = fileName('report', p, format, sv.clock.now());
    if (downloadText(name, body, MIME[format])) say(copy.flows.downloaded(name));
  };

  /** SPEC-DEEP-01: the sheet lists what is sent; consent is minted from the Send click. */
  const openDeep = async () => {
    if (!run) return;
    try {
      setPreview(await deep.preview(run));
    } catch (e) {
      setError(errorView(e));
    }
  };
  const sends = (pv: DeepPreview): SendList => ({
    images: pv.images,
    text: [`${pv.contractItems} contract items`, `${pv.measurements} findings with measurements`],
  });

  const precomputedDeep = async () => {
    if (!run) return;
    setError(undefined);
    await deep.applyPrecomputed(run, (await sample()).precomputed.deep);
    refresh();
  };

  const sendDeep = (ev: { isTrusted: boolean }) => {
    if (!run || !preview || deepRunning.current) return;
    const pv = preview;
    let token: ConsentToken;
    try {
      token = mintConsent({ scope: 'deep', runId: run.id }, ev);
    } catch (e) {
      setPreview(undefined);
      setError(errorView(e));
      return;
    }
    setPreview(undefined);
    setError(undefined);
    setDeepDone(undefined);
    deepRunning.current = true;
    setDeepBusy(true);
    deep
      .run(pv, token, (step) => void recordCloudStep(sv, projectId, step))
      .then((after) => setDeepDone(refinedCount(run, after)))
      .catch((e: unknown) => setError({ ...errorView(e), precomputedDeep: p.isSample }))
      .finally(() => {
        deepRunning.current = false;
        setDeepBusy(false);
        refresh();
      });
  };

  /** SPEC-RUN-13: "Allow cloud to judge live" asks for consent and re-runs only the Judged stage. */
  const allowLive = async () => {
    if (!run) return;
    setBusy(true);
    try {
      const [settings, status] = await Promise.all([settingsStore.read(), ai.status()]);
      // Without a token the Judged stage asks through `needs-consent`, with the exact list to send.
      const projectConsent = sv.consents.get(p) as ConsentToken;
      await runs.rejudge(run.id, { settings, status, projectConsent }, (e) => {
        if (e.kind === 'stage') return void recordCloudStep(sv, projectId, e.step);
        void consent.request(e.sends, copy.flows.consent.run).then((t) => e.resume(t));
      });
    } catch (e) {
      setError(errorView(e));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const closeReverify = () => {
    const q = new URLSearchParams(params);
    q.delete('reverify');
    setParams(q, { replace: true });
  };

  let runProgress: Progress | undefined;
  if (starting && progress) {
    runProgress = {
      total: contract?.requirements.filter((r) => r.accepted).length ?? 0,
      steps: progress.steps,
      current: 'Checking requirements',
      waitingConsent: progress.waiting,
      onStop: () => abort.current?.abort(),
    };
  }

  const deepNotice: ReactNode = deepBusy ? (
    <div className="notice notice-info" role="status" aria-busy="true">
      <Glyph d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <p className="title">{copy.flows.deep.running}</p>
      <p className="small muted">{copy.flows.deep.runningDetail}</p>
    </div>
  ) : deepDone !== undefined ? (
    <div className="notice notice-info" role="status">
      <Glyph d="M12 11v6M12 7.5v.5" />
      <p className="title">{deepDone > 0 ? copy.flows.deep.refined(deepDone) : copy.flows.deep.nothing}</p>
      <p className="small muted">{deepDone > 0 ? copy.flows.deep.refinedDetail : copy.flows.deep.nothingDetail}</p>
    </div>
  ) : undefined;
  const banner: ReactNode = run?.precomputed ? (
    <SampleBanner {...(p.isSample && !busy && { onAllowLive: () => void allowLive() })} />
  ) : undefined;
  const notices: ReactNode =
    deepNotice || banner ? (
      <>
        {deepNotice}
        {banner}
      </>
    ) : undefined;

  const errorProp: RunScreenProps['error'] = error
    ? {
        title: error.title,
        ...(error.detail && { details: [error.detail] }),
        actions: error.precomputedDeep ? (
          <button className="btn" type="button" onClick={() => void precomputedDeep()}>
            {copy.flows.deep.showPrecomputed}
          </button>
        ) : (
          <Link className="btn" to={`/p/${p.id}`}>
            Back to project
          </Link>
        ),
      }
    : undefined;

  const hrefs = run
    ? {
        run: `/p/${p.id}/run/${run.id}`,
        fix: `/p/${p.id}/run/${run.id}`,
        reverify: `/p/${p.id}/run/${run.id}?reverify=1`,
      }
    : undefined;
  const selected = params.get('f');

  return (
    <>
      <ProjectHead
        project={p}
        step="run"
        done={Math.max(done, 3)}
        next={next}
        crumb={crumb}
        {...(hrefs && { hrefs })}
      />
      <RunScreen
        project={{ id: p.id, name: p.name }}
        {...(run && { run })}
        {...(number && { runNumber: number })}
        findings={findings}
        summary={summary}
        {...(contract && {
          requirements: contract.requirements,
          contract: { version: contract.version, locked: contract.locked },
        })}
        {...(runProgress && { progress: runProgress })}
        {...(errorProp && { error: errorProp })}
        {...(notices && { notices })}
        {...(run && {
          deepSlot: (
            <DeepAnalysisButton
              {...(deepReason && { disabledReason: deepReason })}
              busy={deepBusy}
              onOpen={() => void openDeep()}
            />
          ),
        })}
        {...(selected && { selectedId: selected })}
        onSelect={(id) => {
          const q = new URLSearchParams(params);
          q.set('f', id);
          setParams(q, { replace: true });
        }}
        images={images}
        {...(fixText !== undefined && { fixPrompt: fixText })}
        history={history}
        onOpenRun={(id) => navigate(`/p/${p.id}/run/${id}`)}
        onReverify={() => {
          const q = new URLSearchParams(params);
          q.set('reverify', '1');
          setParams(q, { replace: true });
        }}
        onCopyFixPrompt={copyFix}
        onCopyText={(t, msg) => void copyText(t, msg)}
        onExport={exportReport}
      />
      {preview ? (
        <DeepConfirmSheet
          sends={sends(preview)}
          targetCount={preview.targets.length}
          model={preview.model}
          usage={preview.remaining}
          totalBytes={preview.totalBytes}
          onSend={sendDeep}
          onCancel={() => setPreview(undefined)}
        />
      ) : null}
      {reverify && run ? (
        <ReverifySheet
          project={p}
          contract={contract}
          run={run}
          runNumber={number ?? 1}
          urls={urls}
          onChanged={refresh}
          onClose={closeReverify}
          onGo={() => navigate(`/p/${p.id}/run/new`)}
        />
      ) : null}
      {manual !== undefined ? <ManualCopySheet text={manual} onClose={() => setManual(undefined)} /> : null}
      {consent.sheet}
      <Toasts message={toast} />
    </>
  );
};

/** Re-verify sheet (prototype run.html `#sheet-reverify`): the new captures per viewport, then Run Re-verify. */
const ReverifySheet: FC<{
  project: Project;
  contract: Contract | undefined;
  run: Run;
  runNumber: number;
  urls: Record<string, string>;
  onChanged(): void;
  onClose(): void;
  onGo(): void;
}> = ({ project, contract, run, runNumber, urls, onChanged, onClose, onGo }) => {
  const sv = useServices();
  const cancel = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const accepted = contract?.requirements.filter((r) => r.accepted).length ?? 0;
  // Nothing new to check while every capture is one the base Run already used.
  const unchanged = project.captures.length > 0 && project.captures.every((c) => run.captureIds.includes(c.id));

  const replace = async (vp: ViewportId, file: File) => {
    setProblem(undefined);
    try {
      await sv.projects.addCapture(project.id, file, vp);
      onChanged();
    } catch (e) {
      setProblem(errorView(e).title);
    }
  };
  const loadFixed = async () => {
    setBusy(true);
    setProblem(undefined);
    try {
      await loadFixedImplementation(sv, project.id);
      onChanged();
    } catch (e) {
      setProblem(errorView(e).title);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet labelledBy="rv-h" onClose={onClose} initialFocus={cancel} wide>
      <div className="sheet-head">
        <div className="stack-sm">
          <h2 id="rv-h">{copy.flows.reverify.title(contract?.version ?? 1)}</h2>
          <p className="muted small">{copy.flows.reverify.lead(accepted)}</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="two" style={{ gap: 'var(--space-4)' }}>
        {VPS.map((vp) => {
          const cap = project.captures.find((c) => c.viewport === vp);
          const src = cap && urls[cap.image.blobId];
          return (
            <div className="stack-sm" key={vp}>
              <span className="label">{VP_NAME[vp]}</span>
              {cap ? (
                <div className="thumb">
                  {src ? (
                    <img className="shot" src={src} alt={`New ${vp} capture`} />
                  ) : (
                    <span className="shot" aria-hidden="true" />
                  )}
                  <div className="small">
                    <div>{`${vp} capture`}</div>
                    <div className="muted">{`${cap.image.cssWidth} × ${Math.round((cap.image.height * cap.image.cssWidth) / cap.image.width)}${cap.dom ? ' · DOM snapshot added' : ''}`}</div>
                  </div>
                  <label className="iconbtn" aria-label={copy.flows.reverify.replace(VP_NAME[vp])}>
                    <Glyph d={REFRESH} small />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) void replace(vp, f);
                      }}
                    />
                  </label>
                </div>
              ) : (
                <p className="none">{copy.flows.reverify.noCapture}</p>
              )}
            </div>
          );
        })}
      </div>
      {problem ? (
        <div className="notice notice-danger" role="alert">
          <p className="title">{problem}</p>
        </div>
      ) : null}
      {unchanged ? (
        <p className="small" id="rv-unchanged">
          {copy.flows.reverify.unchanged(runNumber)}
        </p>
      ) : null}
      <p className="small muted">{copy.flows.reverify.sampleHint}</p>
      {project.isSample ? (
        <div>
          <LoadFixedButton busy={busy} primary={unchanged} onLoad={() => void loadFixed()} />
        </div>
      ) : null}
      <div className="sheet-foot">
        <button className="btn" type="button" ref={cancel} onClick={onClose}>
          Cancel
        </button>
        <button
          className={unchanged ? 'btn' : 'btn btn-primary'}
          type="button"
          aria-disabled={unchanged || undefined}
          aria-describedby={unchanged ? 'rv-unchanged' : undefined}
          onClick={unchanged ? undefined : onGo}
        >
          <Glyph d={REFRESH} small />
          {copy.flows.reverify.go}
        </button>
      </div>
    </Sheet>
  );
};

export default RunRoute;
