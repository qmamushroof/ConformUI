import { ContractScreen, type ExtractingView } from '@contract';
import { describeComparison } from '@demo';
import { contractJson, contractMarkdown, fileName } from '@export';
import type { ConsentToken, Contract, Project, TraceStep, ViewportId } from '@kernel';
import { ProjectHead } from '@projects';
import { EngineBadge } from '@settings';
import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { copy } from '../copy';
import { useConsentPrompt } from '../flows/consent';
import { type FallbackWhy, precomputedNote, whyFromBlocked, whyFromError } from '../flows/extract-reason';
import { downloadText, MIME } from '../flows/files';
import { blockedView, type ErrorView, errorView, stepper } from '../flows/helpers';
import { recordCloudStep } from '../flows/usage';
import { NotFound } from '../not-found';
import { useServices } from '../services';

interface Data {
  project: Project;
  contract?: Contract;
  pending?: Contract;
  designSrc: Partial<Record<ViewportId, string>>;
  runs: number;
  /** "Run 1": the first Run that used the active Contract. */
  lockedBy?: string;
}

type Load = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; data: Data };

const VP_NAME: Record<ViewportId, string> = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' };

function sourceOf(c: Contract): 'on-device' | 'cloud' | 'precomputed' {
  // Rule-based Inferred items and manual ones say nothing about where the extraction came from.
  const made = c.requirements.filter((r) => r.origin !== 'rule' && r.origin !== 'user');
  if (made.length > 0 && made.every((r) => r.origin === 'precomputed')) return 'precomputed';
  return made.some((r) => r.engine === 'cloud') ? 'cloud' : 'on-device';
}

/** Progress of an extraction in flight, from the TraceSteps the service reports (PRD-F-04.4). */
function extractingView(project: Project, steps: TraceStep[], waiting: boolean): ExtractingView {
  const design = project.designs[0];
  const last = steps[steps.length - 1];
  return {
    engine: last?.engine === 'cloud' ? 'cloud' : 'on-device',
    viewportLabel: design ? VP_NAME[design.viewport] : VP_NAME.desktop,
    stages: [
      ...steps.map((s) => ({ label: s.step, state: 'done' as const, detail: 'Done', percent: 100 })),
      {
        label: 'Reading the design',
        state: waiting ? ('wait' as const) : ('run' as const),
        detail: waiting ? 'Waiting for your choice' : 'Running',
        percent: waiting ? 0 : 50,
      },
    ],
  };
}

/**
 * `/p/:projectId/contract` (SPEC-CON-*): loads the Project, its active and pending Contract and the design images, and
 * wires extraction, the Project consent sheet (SPEC-CON-01 step 1, SPEC-DEMO-05), usage recording and exports.
 */
const ContractRoute: FC = () => {
  const { projectId = '' } = useParams();
  const sv = useServices();
  const { projects, contract, store, blobs, settingsStore, ai, sample } = sv;
  const navigate = useNavigate();
  const { useAiContract: adoptAi } = contract;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [extractError, setExtractError] = useState<ErrorView>();
  const [steps, setSteps] = useState<TraceStep[] | undefined>();
  const [waiting, setWaiting] = useState(false);
  const [why, setWhy] = useState<FallbackWhy>();
  const [version, setVersion] = useState(0);
  const cancelled = useRef({ v: false });
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const project = load.kind === 'ready' ? load.data.project : undefined;
  const consent = useConsentPrompt(sv, project);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads after a service call.
  useEffect(() => {
    let live = true;
    const urls: string[] = [];
    (async () => {
      const p = await projects.get(projectId);
      if (!p) return live && setLoad({ kind: 'missing' });
      const active = await contract.active(projectId);
      const pending = p.pendingAiContractId ? await store.getContract(p.pendingAiContractId) : undefined;
      const all = await store.listRuns(projectId);
      const oldestFirst = [...all].sort((a, b) => a.createdAt - b.createdAt);
      const first = active ? oldestFirst.findIndex((r) => r.contractId === active.id) : -1;
      const designSrc: Partial<Record<ViewportId, string>> = {};
      for (const d of p.designs) {
        const blob = await blobs.get(d.image.blobId);
        if (blob && typeof URL.createObjectURL === 'function') {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          designSrc[d.viewport] = url;
        }
      }
      const data: Data = {
        project: p,
        designSrc,
        runs: all.length,
        ...(active && { contract: active }),
        ...(pending && { pending }),
        ...(first >= 0 && { lockedBy: `Run ${first + 1}` }),
      };
      if (live) setLoad({ kind: 'ready', data });
    })().catch(() => live && setLoad({ kind: 'missing' }));
    return () => {
      live = false;
      for (const u of urls) URL.revokeObjectURL?.(u);
    };
  }, [projectId, projects, contract, store, blobs, version]);

  /** SPEC-DEMO-05: on a sample, the stored extraction stands in after Decline, blocked or failed. */
  const showPrecomputed = async (reason: FallbackWhy) => {
    setWhy(reason);
    const assets = await sample();
    await contract.loadPrecomputedExtraction(projectId, assets.precomputed.extraction);
  };

  const extract = async (token?: ConsentToken): Promise<void> => {
    const mine = { v: false };
    cancelled.current = mine;
    setExtractError(undefined);
    setWhy(undefined);
    setSteps([]);
    setWaiting(false);
    let p: Project | undefined;
    try {
      p = await projects.get(projectId);
      if (!p) return;
      const [settings, status] = await Promise.all([settingsStore.read(), ai.status()]);
      const projectConsent = token ?? sv.consents.get(p);
      const sent: TraceStep[] = [];
      const out = await contract.extract(
        projectId,
        { settings, status, ...(projectConsent && { projectConsent }) },
        (step) => {
          sent.push(step);
          if (!mine.v) setSteps((s) => [...(s ?? []), step]);
        },
      );
      // Recorded after the service returns: it saves the Project it read at the start, which would overwrite usage
      // recorded while it ran.
      for (const step of sent) await recordCloudStep(sv, projectId, step);
      if (out.kind === 'needs-consent') {
        setWaiting(true);
        const granted = await consent.request(out.sends, copy.flows.consent.extract);
        setWaiting(false);
        if (granted) return await extract(granted);
        if (p.isSample) await showPrecomputed('declined');
      } else if (out.kind === 'blocked') {
        if (p.isSample) await showPrecomputed(whyFromBlocked(out.reason, out.errorCode));
        else setExtractError(blockedView(out.reason, out.errorCode, out.errorEngine));
      }
    } catch (e) {
      if (p?.isSample) await showPrecomputed(whyFromError(e)).catch((err: unknown) => setExtractError(errorView(err)));
      else setExtractError(errorView(e));
    } finally {
      if (!mine.v) setSteps(undefined);
      setWaiting(false);
      refresh();
    }
  };

  if (load.kind === 'loading') return <main id="main" tabIndex={-1} className="page" aria-busy="true" />;
  if (load.kind === 'missing') return <NotFound />;
  const { project: proj, contract: active, pending, designSrc, runs, lockedBy } = load.data;
  const { done, next } = stepper(proj, runs);
  const comparison =
    pending && active && proj.isSample ? describeComparison(pending.requirements, active.requirements) : undefined;

  const exportContract = (format: 'md' | 'json') => {
    const c = pending ?? active;
    if (!c) return;
    const name = fileName('contract', proj, format, sv.clock.now());
    const body = format === 'md' ? contractMarkdown(c, proj) : `${JSON.stringify(contractJson(c, proj), null, 2)}\n`;
    downloadText(name, body, MIME[format]);
  };

  const ensureContract = async (): Promise<Contract> => {
    const made: Contract = {
      id: sv.ids.next(),
      projectId,
      version: 1,
      createdAt: sv.clock.now(),
      locked: false,
      requirements: [],
    };
    await store.putContract(made);
    await store.put({ ...proj, activeContractId: made.id, updatedAt: sv.clock.now() });
    return made;
  };

  const keepVerified = async () => {
    const { pendingAiContractId: _gone, ...rest } = proj;
    await store.put({ ...rest, updatedAt: sv.clock.now() });
    refresh();
  };

  return (
    <>
      <ProjectHead project={proj} step="contract" done={done} next={next} crumb="Contract" />
      <ContractScreen
        project={proj}
        {...(active && { contract: active })}
        {...(pending && { pending, pendingSource: sourceOf(pending) })}
        {...(pending && sourceOf(pending) === 'precomputed' && { pendingNote: precomputedNote(why) })}
        {...(comparison && { comparison })}
        {...(lockedBy && { lockedBy })}
        designSrc={designSrc}
        service={contract}
        ensureContract={ensureContract}
        {...(steps && { extracting: extractingView(proj, steps, waiting) })}
        {...(extractError && { extractError })}
        onExtract={() => void extract()}
        onStopExtract={() => {
          cancelled.current.v = true;
          setSteps(undefined);
          setWaiting(false);
        }}
        onAddDesign={() => navigate(`/p/${proj.id}#captures`)}
        onContinue={() => navigate(`/p/${proj.id}#captures`)}
        onUseAi={() => void adoptAi(projectId).then(refresh)}
        onKeepVerified={() => void keepVerified()}
        onExport={exportContract}
        onChange={refresh}
        renderBadge={(r) => <EngineBadge engine={r.engine ?? 'measured'} origin={r.origin} />}
      />
      {consent.sheet}
    </>
  );
};
export default ContractRoute;
