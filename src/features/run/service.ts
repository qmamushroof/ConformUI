import {
  type Capture,
  type Contract,
  CuiError,
  type ImageMeta,
  lockContract,
  type Project,
  type Requirement,
  type RequirementResult,
  type Run,
  THRESHOLD_KEYS,
  type Thresholds,
  type TraceStep,
  VIEWPORT_PREFIX,
  type ViewportId,
} from '@kernel';
import { compareRuns, runSummary, summarise } from './compare';
import { resultFromOutcome, sortedFindings } from './findings';
import { runHandler } from './handlers';
import { type JudgeItem, judgeStage, keyOf, type ViewportRun } from './judge';
import type { RunDeps, RunEvent, RunService, ViewportCtx } from './types';

// RunService (SPEC §4.8.1, SPEC-RUN-01, SPEC-RUN-02, SPEC-RUN-12, SPEC-RUN-13). Imports the kernel and measure only.

const VIEWPORT_ORDER: ViewportId[] = ['desktop', 'mobile', 'tablet'];

const storageError = (message: string) => new CuiError('STORAGE_FAILED', message);

/** Snapshot of the threshold keys of the runtime values (PRD-P-10, S14). */
function thresholdsOf(values: Record<string, unknown>): Thresholds {
  const out: Record<string, unknown> = {};
  for (const k of THRESHOLD_KEYS) out[k] = values[k];
  return out as unknown as Thresholds;
}

interface Evaluated {
  /** Results of deterministic stages, in Contract order; Judged ones are filled later. */
  results: Map<string, RequirementResult>;
  order: string[];
  items: JudgeItem[];
  stopped: boolean;
}

export function createRunService(d: RunDeps): RunService {
  type StartCtx = Parameters<RunService['start']>[1];
  type RejudgeCtx = Parameters<RunService['rejudge']>[1];
  const queues = new Map<string, Promise<unknown>>();

  /** SPEC-RUN-02: one Run at a time per Project; later calls wait their turn. */
  function exclusive<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
    const prev = queues.get(projectId) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    queues.set(
      projectId,
      next.catch(() => undefined),
    );
    return next;
  }

  async function load(projectId: string): Promise<{ project: Project; contract: Contract }> {
    const project = await d.store.get(projectId);
    if (!project) throw storageError('Project not found');
    if (!project.activeContractId) throw storageError('The Project has no active Contract');
    const contract = await d.store.getContract(project.activeContractId);
    if (!contract) throw storageError('The active Contract was not found');
    return { project, contract };
  }

  /** One ViewportRun per capture; pixels and blobs load once, on first use. */
  async function viewportRuns(project: Project, captureIds: string[] | undefined, t: Thresholds) {
    const out = new Map<ViewportId, ViewportRun>();
    const captures: Capture[] = project.captures.filter((c) => !captureIds || captureIds.includes(c.id));
    for (const cap of captures) {
      const design = project.designs.find((x) => x.viewport === cap.viewport);
      const blobOf = (id: string | undefined) => (id ? d.blobs.get(id) : Promise.resolve(undefined));
      const once = <T>(fn: () => Promise<T>) => {
        let p: Promise<T> | undefined;
        return () => (p ??= fn());
      };
      const designBlob = once(() => blobOf(design?.image.blobId));
      const captureBlob = once(() => blobOf(cap.image.blobId));
      const px = (blob: () => Promise<Blob | undefined>) =>
        once(async () => {
          const b = await blob();
          return b ? d.codec.pixels(b) : undefined;
        });
      const designPx = px(designBlob);
      const capturePx = px(captureBlob);
      let alignment: ViewportCtx['alignment'];
      if (design) {
        const dm: ImageMeta = {
          width: design.image.width,
          height: design.image.height,
          cssWidth: design.image.cssWidth,
        };
        const cm: ImageMeta = { width: cap.image.width, height: cap.image.height, cssWidth: cap.image.cssWidth };
        alignment = await d.measure.align(dm, { ...cm, ...(cap.dom && { dom: cap.dom }) }, t);
      }
      out.set(cap.viewport, {
        viewport: cap.viewport,
        t,
        m: d.measure,
        ...(cap.dom && { dom: cap.dom }),
        ...(design && { designImage: design.image }),
        captureImage: cap.image,
        ...(alignment && { alignment }),
        designPx,
        capturePx,
        designBlob,
        captureBlob,
      });
    }
    return out;
  }

  /** Steps 1 and 2 of SPEC-RUN-01: Measured then Visual stage per viewport; Judged items are collected. */
  async function evaluate(
    contract: Contract,
    vps: Map<ViewportId, ViewportRun>,
    runId: string,
    emit: (s: TraceStep) => void,
    signal?: AbortSignal,
  ): Promise<Evaluated> {
    const accepted = contract.requirements.filter((r) => r.accepted);
    const results = new Map<string, RequirementResult>();
    const order: string[] = [];
    const items: JudgeItem[] = [];
    const slot = (key: string, r: RequirementResult | undefined) => {
      order.push(key);
      if (r) results.set(key, r);
    };
    const stopped = () => signal?.aborted === true;

    const one = async (req: Requirement, v: ViewportRun) => {
      const key = keyOf(req);
      try {
        const out = await runHandler(req, v);
        if (out.kind === 'judge') {
          slot(key, undefined);
          items.push({ req, need: out, v });
          return;
        }
        slot(key, resultFromOutcome({ runId, req, outcome: out }));
      } catch (e) {
        // SPEC-RUN-02, PRD-P-09: a handler error costs that Requirement only.
        const reason = e instanceof CuiError && e.code.startsWith('IMAGE') ? 'no-capture' : 'region-unresolved';
        slot(
          key,
          resultFromOutcome({
            runId,
            req,
            outcome: {
              kind: 'result',
              status: 'not-checked',
              reason,
              hint: e instanceof Error ? e.message : 'The check failed',
              confidence: 'low',
              facts: { measurements: [] },
            },
          }),
        );
      }
    };

    for (const viewport of VIEWPORT_ORDER) {
      const mine = accepted.filter((r) => r.viewport === viewport);
      const v = vps.get(viewport);
      if (mine.length === 0 && !v) continue;
      if (!v) {
        for (const req of mine) {
          if (stopped()) return { results, order, items, stopped: true };
          slot(
            keyOf(req),
            resultFromOutcome({
              runId,
              req,
              outcome: {
                kind: 'result',
                status: 'not-checked',
                reason: 'no-capture',
                confidence: 'low',
                facts: { measurements: [] },
              },
            }),
          );
        }
        continue;
      }
      for (const stage of ['measured', 'visual', 'judged'] as const) {
        const reqs = mine.filter((r) => r.checkType === stage);
        if (reqs.length === 0) continue;
        const started = d.clock.now();
        for (const req of reqs) {
          if (stopped()) return { results, order, items, stopped: true };
          await one(req, v);
        }
        if (stage !== 'judged') {
          emit({
            step: `${stage} ${viewport}`,
            engine: 'measured',
            durationMs: Math.max(0, d.clock.now() - started),
            bytesSent: 0,
          });
        }
      }
    }

    // A viewport with a capture, no design and no Inferred items (SPEC-RUN-01 step 1).
    for (const [viewport, v] of vps) {
      const hasInferred = accepted.some((r) => r.viewport === viewport && r.label === 'inferred');
      if (v.designImage || hasInferred) continue;
      if (stopped()) return { results, order, items, stopped: true };
      const key = `I-${VIEWPORT_PREFIX[viewport]}-00:${viewport}`;
      order.push(key);
      results.set(key, {
        requirementId: `I-${VIEWPORT_PREFIX[viewport]}-00`,
        viewport,
        status: 'not-checked',
        reason: 'no-inferred-items',
        hint: 'Re-open contract',
        engine: 'measured',
        confidence: 'low',
      });
    }
    return { results, order, items, stopped: false };
  }

  async function baselineOf(projectId: string, contractId: string, exceptId: string, createdAt: number) {
    const runs = await d.store.listRuns(projectId);
    return runs
      .filter((r) => r.id !== exceptId && r.contractId === contractId && r.createdAt <= createdAt)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  function start(projectId: string, ctx: StartCtx, on: (e: RunEvent) => void, signal?: AbortSignal): Promise<Run> {
    return exclusive(projectId, async () => {
      const { project, contract } = await load(projectId);
      const runId = d.ids.next();
      const createdAt = d.clock.now();
      const t = thresholdsOf(d.config.get() as unknown as Record<string, unknown>);
      const trace: TraceStep[] = [];
      const emit = (step: TraceStep) => {
        trace.push(step);
        on({ kind: 'stage', step });
      };
      const vps = await viewportRuns(project, undefined, t);
      const ev = await evaluate(contract, vps, runId, emit, signal);
      let stopped = ev.stopped;
      if (!stopped && ev.items.length > 0) {
        const judged = await judgeStage(
          { d, ctx, isSample: project.isSample, runId, on, emit, ...(signal && { signal }) },
          ev.items,
        );
        stopped = judged.stopped;
        for (const [key, r] of judged.results) ev.results.set(key, r);
        // Items cut off by Abort have no result and are omitted from the partial Run.
      }
      if (stopped) emit({ step: 'stopped', engine: 'measured', durationMs: 0, bytesSent: 0, note: 'Stopped' });

      const results = ev.order.flatMap((k) => {
        const r = ev.results.get(k);
        return r ? [r] : [];
      });
      const run: Run = {
        id: runId,
        projectId,
        contractId: contract.id,
        createdAt,
        captureIds: project.captures.map((c) => c.id),
        thresholds: t,
        results,
        trace,
        precomputed: results.some((r) => r.origin === 'precomputed'),
      };
      const baseline = await baselineOf(projectId, contract.id, runId, createdAt);
      const withBaseline: Run = baseline
        ? { ...run, baselineRunId: baseline.id, changes: compareRuns(baseline, run) }
        : run;
      await d.store.putRun(withBaseline);
      await d.store.putContract(lockContract(contract));
      return withBaseline;
    });
  }

  async function rejudge(runId: string, ctx: RejudgeCtx, on: (e: RunEvent) => void): Promise<Run> {
    const first = await d.store.getRun(runId);
    if (!first) throw storageError('Run not found');
    return exclusive(first.projectId, async () => {
      const stored = (await d.store.getRun(runId)) ?? first;
      const project = await d.store.get(stored.projectId);
      const contract = await d.store.getContract(stored.contractId);
      if (!project || !contract) throw storageError('The Run no longer has its Project or Contract');
      const vps = await viewportRuns(project, stored.captureIds, stored.thresholds);
      const trace: TraceStep[] = [...stored.trace];
      const emit = (step: TraceStep) => {
        trace.push(step);
        on({ kind: 'stage', step });
      };
      // The deterministic stages run again only to find the Judged items; their results are discarded.
      const ev = await evaluate(contract, vps, runId, () => undefined);
      const judged = await judgeStage({ d, ctx, isSample: false, runId, on, emit }, ev.items);
      const replaced = new Map(judged.results);
      const results = stored.results.map((r): RequirementResult => {
        const next = replaced.get(keyOf({ id: r.requirementId, viewport: r.viewport }));
        // A live attempt that gave no answer keeps what the Run already has.
        return next && next.status !== 'not-checked' ? next : r;
      });
      const run: Run = { ...stored, results, trace, precomputed: results.some((r) => r.origin === 'precomputed') };
      const baseline = stored.baselineRunId ? await d.store.getRun(stored.baselineRunId) : undefined;
      const { changes: _old, ...rest } = run;
      const saved: Run = baseline ? { ...rest, changes: compareRuns(baseline, run) } : rest;
      await d.store.putRun(saved);
      return saved;
    });
  }

  return {
    start,
    rejudge,
    async history(projectId) {
      const runs = (await d.store.listRuns(projectId)).sort((a, b) => b.createdAt - a.createdAt);
      const versions = new Map<string, number>();
      for (const r of runs) {
        if (!versions.has(r.contractId))
          versions.set(r.contractId, (await d.store.getContract(r.contractId))?.version ?? 0);
      }
      return runs.map((r) => runSummary(r, versions.get(r.contractId) ?? 0));
    },
    get: (id) => d.store.getRun(id),
    findings: sortedFindings,
    summary: summarise,
  };
}
