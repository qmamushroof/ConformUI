import type { Change, Finding, Requirement, Run, RunSummary, ViewportId } from '@kernel';
import { type FC, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import type { EvidenceImage } from './comparison-view';
import { EngineTrace } from './engine-trace';
import { FindingDetail } from './finding-detail';
import { FindingList, type ResolvedItem } from './finding-list';
import { Icon } from './icon';
import { dateText, REASON_TEXT, VP_NAME, VP_TEXT } from './labels';
import { RunHistory } from './run-history';
import { RunProgress, type RunProgressProps } from './run-progress';
import { type ExportAction, type ExportFormat, ExportSheet, FixPromptSheet } from './run-sheets';

/** What `RunService.summary(run)` returns. */
export interface RunSummaryView {
  pass: number;
  fail: number;
  review: number;
  notChecked: number;
  changes?: Record<Change, number>;
  line: string;
}

/** An error the Run could not recover from, for example an unreadable DOM snapshot (PRD-F-13.3). */
export interface RunErrorView {
  title: string;
  /** Shown as a list; at most 5 lines (SPEC-SNIP-08). */
  details?: readonly string[];
  /** Links or buttons of the notice, built by `app`. */
  actions?: ReactNode;
}

/**
 * Routed screen `/p/:projectId/run/:runId` (SPEC §4.13.2). Controlled: it reads the Run and what `RunService` derived
 * from it, and reports every action through a callback; services, clipboard, toasts, routing and the Deep/consent
 * sheets (task 13.6, `settings`) stay in `app` (SPEC-ARCH-07).
 */
export interface RunScreenProps {
  project: { id: string; name: string };
  /** The finished Run; absent while `progress` is shown or when it was not found. */
  run?: Run | undefined;
  /** "Run 2": 1 for the oldest Run of the project. */
  runNumber?: number | undefined;
  /** `RunService.findings(run)`: sorted, SPEC-RUN-08. */
  findings: readonly Finding[];
  /** `RunService.summary(run)`. */
  summary: RunSummaryView;
  /** The Contract's Requirements (statements for Passing, Not checked and resolved rows, category in the detail). */
  requirements?: readonly Requirement[] | undefined;
  /** Version and lock of the Contract the Run checked. */
  contract?: { version: number; locked: boolean } | undefined;
  /** A Run in flight: the stage list replaces the findings. */
  progress?: RunProgressProps | undefined;
  error?: RunErrorView | undefined;
  /** Notices under the header: the sample banner "Sample results (pre-computed)" and consent prompts (13.6). */
  notices?: ReactNode;
  /** `DeepAnalysisButton` (13.6) with its disabled reason. */
  deepSlot?: ReactNode;
  /** `?f=<findingId>`; selection is also kept here, so `onSelect` only needs to update the URL. */
  selectedId?: string | undefined;
  onSelect?(findingId: string): void;
  /** Object URLs resolved by `app`: design and capture images per viewport, optional pixelmatch masks per Finding id. */
  images?:
    | {
        design?: Partial<Record<ViewportId, EvidenceImage>>;
        capture?: Partial<Record<ViewportId, EvidenceImage>>;
        diff?: Record<string, EvidenceImage>;
      }
    | undefined;
  /** Text of the fix prompt (export feature); enables "Preview fix prompt". */
  fixPrompt?: string | undefined;
  /** `RunService.history(projectId)`, newest first; listed when there is more than one Run. */
  history?: readonly RunSummary[] | undefined;
  onOpenRun?(runId: string): void;
  onReverify?(): void;
  onCopyFixPrompt?(): void;
  /** Copy text and show a toast ("Run ID copied", "Selector copied"). */
  onCopyText?(text: string, toast: string): void;
  onExport?(format: ExportFormat, action: ExportAction): void;
}

const TITLE_ID = 'finding-title';
const VP_ORDER: ViewportId[] = ['desktop', 'mobile', 'tablet'];
const shortId = (id: string) => (id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);

const Count: FC<{
  n: number;
  word: string;
  icon: 'x' | 'check' | 'dash' | 'review' | 'up' | 'down' | 'plus';
  cls: string;
}> = ({ n, word, icon, cls }) => (
  <span className={`st ${cls}`}>
    <Icon name={icon} />
    <b>{n}</b> {word}
  </span>
);

function SummaryBar({ s }: { s: RunSummaryView }) {
  const c = s.changes;
  if (c) {
    return (
      <div className="summary" data-testid="run-summary">
        <Count n={c.resolved} word="resolved" icon="up" cls={c.resolved > 0 ? 'st-pass' : 'st-nc'} />
        <Count n={c.remaining} word="remaining" icon="x" cls={c.remaining > 0 ? 'st-fail' : 'st-nc'} />
        <Count n={c.new} word="new" icon="plus" cls="st-nc" />
        <Count n={c.regressed} word="regressed" icon="down" cls={c.regressed > 0 ? 'st-fail' : 'st-nc'} />
      </div>
    );
  }
  return (
    <div className="summary" data-testid="run-summary">
      <Count n={s.fail} word="fail" icon="x" cls="st-fail" />
      {s.review > 0 && <Count n={s.review} word="needs review" icon="review" cls="st-review" />}
      <Count n={s.pass} word="pass" icon="check" cls="st-pass" />
      <Count n={s.notChecked} word="not checked" icon="dash" cls="st-nc" />
    </div>
  );
}

const Notice: FC<{ kind?: 'danger' | 'info'; role?: 'alert' | 'status'; testId?: string; children: ReactNode }> = ({
  kind = 'info',
  role,
  testId,
  children,
}) => (
  <div style={{ padding: '0 var(--space-6) var(--space-5)' }}>
    <div className={`notice notice-${kind}`} role={role} data-testid={testId}>
      <Icon name={kind === 'danger' ? 'alert' : 'info'} />
      {children}
    </div>
  </div>
);

export const RunScreen: FC<RunScreenProps> = (p) => {
  const { run, summary, findings, requirements = [], images } = p;
  const [vp, setVp] = useState<'all' | ViewportId>('all');
  const [sel, setSel] = useState<string | undefined>(p.selectedId);
  const [announce, setAnnounce] = useState('');
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<'prompt' | 'export' | null>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const menuWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (p.selectedId) setSel(p.selectedId);
  }, [p.selectedId]);

  const runId = run?.id;
  const hasChanges = run?.changes !== undefined;
  const { fail, review, line } = summary;
  useEffect(() => {
    if (!runId) return;
    setAnnounce(
      hasChanges
        ? `Re-verify complete: ${line}`
        : `Run complete: ${fail} fail${review > 0 ? `, ${review} needs review` : ''}`,
    );
  }, [runId, hasChanges, fail, review, line]);
  const total = p.progress?.total;
  useEffect(() => {
    if (total !== undefined) setAnnounce(`Checking ${total} ${total === 1 ? 'requirement' : 'requirements'}`);
  }, [total]);

  useEffect(() => {
    if (!menu) return;
    const away = (e: MouseEvent) => {
      if (menuWrap.current && !menuWrap.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [menu]);

  const reqOf = (id: string) => requirements.find((r) => r.id === id);
  const results = run?.results ?? [];

  const resolved: ResolvedItem[] = run?.changes
    ? results
        .filter((r) => r.status === 'pass' && run.changes?.[`${r.requirementId}:${r.viewport}`] === 'resolved')
        .map((r) => {
          const req = reqOf(r.requirementId);
          return {
            id: `${run.id}:${r.requirementId}:${r.viewport}:resolved`,
            requirementId: r.requirementId,
            viewport: r.viewport,
            title: req?.statement ?? r.requirementId,
            label: req?.label ?? 'explicit',
          };
        })
    : [];

  const present = VP_ORDER.filter((v) => results.some((r) => r.viewport === v && r.reason !== 'no-capture'));
  const visibleFindings = findings.filter((f) => vp === 'all' || f.viewport === vp);
  const visibleResolved = resolved.filter((r) => vp === 'all' || r.viewport === vp);
  const countOf = (v: 'all' | ViewportId) =>
    v === 'all'
      ? findings.length + resolved.length
      : findings.filter((f) => f.viewport === v).length + resolved.filter((r) => r.viewport === v).length;
  const orderedIds = [...visibleFindings.map((f) => f.id), ...visibleResolved.map((r) => r.id)];
  const activeId = sel !== undefined && orderedIds.includes(sel) ? sel : orderedIds[0];
  const activeFinding = visibleFindings.find((f) => f.id === activeId);
  const activeResolved = visibleResolved.find((r) => r.id === activeId);

  const choose = (id: string) => {
    setSel(id);
    p.onSelect?.(id);
    const f = findings.find((x) => x.id === id);
    const r = resolved.find((x) => x.id === id);
    setAnnounce(f ? f.statement : r ? `Resolved: ${r.title}` : '');
  };
  const activate = () => {
    if (typeof window === 'undefined' || window.innerWidth >= 1100) return;
    const detail = document.getElementById('run-detail');
    const title = document.getElementById(TITLE_ID);
    if (typeof detail?.scrollIntoView === 'function') detail.scrollIntoView({ block: 'start' });
    title?.focus({ preventScroll: true });
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && menu) {
      e.preventDefault();
      setMenu(false);
      menuBtn.current?.focus();
    }
  };

  const stopped = run?.trace.some((s) => s.step === 'stopped') ?? false;
  const accepted = requirements.filter((r) => r.accepted).length;
  const passing = results.filter((r) => r.status === 'pass');
  const notChecked = results.filter((r) => r.status === 'not-checked');
  const title = p.runNumber ? `Run ${p.runNumber}` : 'Run';
  const viewportText = present.map((v) => VP_TEXT[v]).join(' and ');

  const notFound = !run && !p.progress && !p.error;

  return (
    <main id="main" tabIndex={-1}>
      <div className="runhead">
        <div className="stack-sm">
          <h1 id="run-title">{title}</h1>
          {run && (
            <div className="meta">
              <span>{dateText(run.createdAt)}</span>
              {p.contract && <span>{`Contract v${p.contract.version}${p.contract.locked ? ', locked' : ''}`}</span>}
              {viewportText && <span>{viewportText}</span>}
              <span className="mono xs">{shortId(run.id)}</span>
            </div>
          )}
          {run && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <SummaryBar s={summary} />
            </div>
          )}
        </div>
        {run && (
          <div className="btn-row">
            {p.deepSlot && <span id="deep-wrap">{p.deepSlot}</span>}
            {p.onReverify && (
              <button type="button" className="btn btn-ghost" onClick={p.onReverify}>
                <Icon name="refresh" small />
                Re-verify
              </button>
            )}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Escape closes the menu; its buttons are the controls */}
            <div className="menu-wrap" ref={menuWrap} onKeyDown={onMenuKey}>
              <button
                type="button"
                className="iconbtn"
                ref={menuBtn}
                aria-haspopup="true"
                aria-expanded={menu}
                aria-label="More run actions"
                onClick={() => setMenu((v) => !v)}
              >
                <Icon name="more" />
              </button>
              <div className="menu" hidden={!menu}>
                {p.fixPrompt !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      setSheet('prompt');
                    }}
                  >
                    <Icon name="eye" small />
                    Preview fix prompt
                  </button>
                )}
                {p.onExport && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      setSheet('export');
                    }}
                  >
                    <Icon name="download" small />
                    Export report
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    p.onCopyText?.(run.id, 'Run ID copied');
                  }}
                >
                  <Icon name="copy" small />
                  Copy run ID
                </button>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={findings.length === 0}
              onClick={p.onCopyFixPrompt}
            >
              <Icon name="copy" small />
              Copy fix prompt
            </button>
          </div>
        )}
      </div>

      {p.error && (
        <Notice kind="danger" role="alert">
          <p className="title">{p.error.title}</p>
          {p.error.details && p.error.details.length > 0 && (
            <ul className="small" style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
              {p.error.details.slice(0, 5).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          {p.error.actions && <div className="btn-row">{p.error.actions}</div>}
        </Notice>
      )}
      {stopped && (
        <Notice role="status" testId="stopped-note">
          <p className="title">The run was stopped.</p>
          <p className="small muted">
            These are partial results: {results.length}
            {accepted > 0 ? ` of ${accepted}` : ''} requirements were checked. Run again to check the rest.
          </p>
        </Notice>
      )}
      {p.notices && <div style={{ padding: '0 var(--space-6) var(--space-5)' }}>{p.notices}</div>}

      {!run && p.progress && <RunProgress {...p.progress} />}
      {notFound && (
        <Notice>
          <p className="title">This run is not available.</p>
          <p className="small muted">It may have been deleted from this device.</p>
        </Notice>
      )}

      {run && (
        <>
          <div className="split">
            <section className="split-list" aria-labelledby="flh">
              <div className="split-list-head">
                <h2 id="flh" className="sr-only">
                  Findings
                </h2>
                {/* biome-ignore lint/a11y/useSemanticElements: prototype markup, a tab-style filter row */}
                <div className="tabs vpfilter" role="group" aria-label="Viewport filter">
                  <button type="button" aria-pressed={vp === 'all'} onClick={() => setVp('all')}>
                    All <span className="muted">{countOf('all')}</span>
                  </button>
                  {present.map((v) => (
                    <button key={v} type="button" aria-pressed={vp === v} onClick={() => setVp(v)}>
                      {VP_NAME[v]} <span className="muted">{countOf(v)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <FindingList
                findings={visibleFindings}
                resolved={visibleResolved}
                {...(run.changes && { changes: run.changes })}
                {...(activeId && { selectedId: activeId })}
                onSelect={choose}
                onActivate={activate}
              />
              <details className="disc" style={{ padding: '0 var(--space-4)' }}>
                <summary>
                  <Icon name="chev" small className="chev" />
                  Passing <span className="count">{passing.length}</span>
                </summary>
                <ul
                  className="small stack-sm disc-body"
                  style={{ listStyle: 'none', margin: 0, paddingLeft: 'var(--space-6)' }}
                >
                  {passing.map((r) => (
                    <li key={`${r.requirementId}:${r.viewport}`}>
                      <span className="mono xs">{r.requirementId}</span> {reqOf(r.requirementId)?.statement ?? ''}
                    </li>
                  ))}
                </ul>
              </details>
              <details className="disc" style={{ padding: '0 var(--space-4)' }} data-testid="not-checked">
                <summary>
                  <Icon name="chev" small className="chev" />
                  Not checked <span className="count">{notChecked.length}</span>
                </summary>
                <ul
                  className="small stack-sm disc-body"
                  style={{ listStyle: 'none', margin: 0, paddingLeft: 'var(--space-6)' }}
                >
                  {notChecked.map((r) => (
                    <li key={`${r.requirementId}:${r.viewport}`}>
                      <span className="mono xs">{r.requirementId}</span> {reqOf(r.requirementId)?.statement ?? ''}
                      <br />
                      <span className="muted">
                        Not checked: {r.reason ? REASON_TEXT[r.reason] : 'no reason was recorded.'}
                        {r.hint ? ` ${r.hint}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
            <section className="split-detail" id="run-detail" aria-labelledby={TITLE_ID}>
              {activeFinding ? (
                <FindingDetail
                  finding={activeFinding}
                  titleId={TITLE_ID}
                  {...(reqOf(activeFinding.requirementId) && {
                    requirement: reqOf(activeFinding.requirementId) as Requirement,
                  })}
                  {...(images?.design?.[activeFinding.viewport] && {
                    design: images.design[activeFinding.viewport] as EvidenceImage,
                  })}
                  {...(images?.capture?.[activeFinding.viewport] && {
                    capture: images.capture[activeFinding.viewport] as EvidenceImage,
                  })}
                  {...(images?.diff?.[activeFinding.id] && { diff: images.diff[activeFinding.id] as EvidenceImage })}
                  {...(p.onCopyText && { onCopyText: p.onCopyText })}
                />
              ) : activeResolved ? (
                <div className="stack-sm">
                  <span className="st st-pass">
                    <Icon name="up" />
                    Resolved
                  </span>
                  <h2 id={TITLE_ID} className="prose" tabIndex={-1}>
                    Resolved: {activeResolved.title}
                  </h2>
                  <p className="muted">This requirement failed in the previous Run and passes now.</p>
                </div>
              ) : (
                <div className="empty">
                  <h2 id={TITLE_ID}>{vp === 'all' ? 'Nothing to fix' : 'No findings for this viewport'}</h2>
                  <p className="muted">
                    {vp === 'all'
                      ? 'Every requirement that was checked passes.'
                      : 'Every requirement checked at this viewport passes.'}
                  </p>
                </div>
              )}
            </section>
          </div>
          <EngineTrace trace={run.trace} />
          {p.history && p.history.length > 1 && p.onOpenRun && (
            <section className="runlevel" aria-labelledby="runs-h">
              <h2 id="runs-h">Runs</h2>
              <RunHistory runs={p.history} currentRunId={run.id} onOpen={p.onOpenRun} />
            </section>
          )}
        </>
      )}

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>

      {sheet === 'prompt' && p.fixPrompt !== undefined && (
        <FixPromptSheet text={p.fixPrompt} onCopy={() => p.onCopyFixPrompt?.()} onClose={() => setSheet(null)} />
      )}
      {sheet === 'export' && p.onExport && <ExportSheet onExport={p.onExport} onClose={() => setSheet(null)} />}
    </main>
  );
};
