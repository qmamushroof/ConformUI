import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  type Capture,
  type Contract,
  DEFAULT_RUNTIME_VALUES,
  type DesignRef,
  type EngineStatus,
  type Project,
  type Run,
  type RuntimeConfig,
  type Settings,
} from '@kernel';
import { inlineMeasureClient } from '@measure';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createFakeAiEngine, type FakeAiEngine } from '../../../src/app/testing/fake-ai-engine';
import { loadSampleAssets, type SampleAssets } from '../../../src/features/demo';
import { fixPrompt } from '../../../src/features/export';
import { createRunService, type RunService } from '../../../src/features/run';
import { fixedClock } from '../../helpers/clock-ids';
import { InMemoryBlobStore, InMemoryProjectStore } from '../../helpers/memory-stores';
import { createNodeImageCodec, encodePng, solidImage } from '../../helpers/node-codec';
import { settings as sampleSettings } from '../../helpers/samples';

// SPEC-TEST-03, SPEC §4.8.8: the committed sample (contract, captures, snapshots, precomputed Judged outputs) run
// through the real Run service with the Node codec, in-memory stores and the FakeAiEngine seam.

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 }); // real images through the whole Run: slow on a loaded machine

const sampleDir = resolve(__dirname, '../../../src/features/demo/sample');
const codec = createNodeImageCodec();

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const rel = decodeURIComponent(new URL(String(input), 'http://x').pathname).replace(
        /^.*\/features\/demo\/sample\//,
        '',
      );
      const body = readFileSync(join(sampleDir, rel));
      return new Response(new Uint8Array(body), {
        headers: { 'content-type': rel.endsWith('.png') ? 'image/png' : 'application/json' },
      });
    }),
  );
}

/** design-desktop.png is a 2x export; the app normalises it to CSS scale (SPEC-MEAS-02), which the test codec does not do. */
async function designAtCss(blob: Blob): Promise<Blob> {
  const src = await codec.pixels(blob);
  const out = solidImage(src.width / 2, Math.floor(src.height / 2), [255, 255, 255, 255]);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      for (let c = 0; c < 4; c++) {
        let s = 0;
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ] as const) {
          s += src.data[((2 * y + dy) * src.width + 2 * x + dx) * 4 + c] ?? 0;
        }
        out.data[(y * out.width + x) * 4 + c] = Math.round(s / 4);
      }
    }
  }
  return new Blob([encodePng(out) as BlobPart], { type: 'image/png' });
}

const AVAILABLE: EngineStatus = { device: 'available', deviceImage: true, online: true, cloud: 'enabled' };
const NO_DEVICE: EngineStatus = { device: 'unavailable', deviceImage: false, online: true, cloud: 'enabled' };
const settings: Settings = sampleSettings({ onboarded: true });

let assets: SampleAssets;
let designBlob: Blob;

beforeAll(async () => {
  stubFetch();
  assets = await loadSampleAssets();
  designBlob = await designAtCss(assets.design.desktop);
  vi.unstubAllGlobals();
});
afterEach(() => vi.unstubAllGlobals());

interface Rig {
  store: InMemoryProjectStore;
  blobs: InMemoryBlobStore;
  clock: ReturnType<typeof fixedClock>;
  ai: FakeAiEngine;
  service: RunService;
  project: Project;
  contract: Contract;
  load(set: 'flawed' | 'fixed'): Promise<void>;
}

async function rig(fakeStatus: EngineStatus = AVAILABLE): Promise<Rig> {
  const store = new InMemoryProjectStore();
  const blobs = new InMemoryBlobStore();
  const clock = fixedClock();
  const config: RuntimeConfig = { get: () => ({ ...DEFAULT_RUNTIME_VALUES }), refresh: async () => undefined };
  // The seam answers each Judged request with the precomputed output of the capture set the request belongs to.
  let current: 'flawed' | 'fixed' = 'flawed';
  const ai = createFakeAiEngine(
    {
      status: fakeStatus,
      outputs: {
        judge: (req: { user: string }) => {
          const data = JSON.parse(req.user.split('<<<DATA\n')[1]?.split('\nDATA>>>')[0] ?? '{}') as {
            requirement: { id: string; viewport: string };
          };
          const out = assets.precomputed[current][`${data.requirement.id}:${data.requirement.viewport}`];
          if (!out) throw new Error(`no precomputed output for ${data.requirement.id}`);
          return out;
        },
      },
    },
    {},
  );
  const service = createRunService({
    ai,
    config,
    store,
    blobs,
    codec,
    measure: inlineMeasureClient(),
    clock,
    ids: {
      next: (() => {
        let n = 0;
        return () => `run-${++n}`;
      })(),
    },
  });

  const ref = async (blob: Blob) => {
    const probe = await codec.probe(blob);
    return {
      blobId: await blobs.put(blob),
      mime: 'image/png' as const,
      width: probe.width,
      height: probe.height,
      cssWidth: probe.width,
      bytes: blob.size,
    };
  };
  const designs: DesignRef[] = [
    { id: 'design-desktop', viewport: 'desktop', image: await ref(designBlob), addedAt: 1 },
  ];
  const contract: Contract = { ...assets.contract, id: 'contract-sample', projectId: 'project-sample' };
  const project: Project = {
    id: 'project-sample',
    name: 'Sample landing page',
    createdAt: 1,
    updatedAt: 1,
    isSample: true,
    designs,
    captures: [],
    activeContractId: contract.id,
    cloudUsage: { requests: 0, bytes: 0 },
  };
  await store.putContract(contract);
  const self: Rig = {
    store,
    blobs,
    clock,
    ai,
    service,
    project,
    contract,
    async load(set) {
      current = set;
      const captures: Capture[] = [];
      for (const vp of ['desktop', 'mobile'] as const) {
        captures.push({
          id: `${set}-${vp}`,
          viewport: vp,
          image: await ref(assets[set][vp].image),
          dom: assets[set][vp].dom,
          addedAt: 1,
          warnings: [],
        });
      }
      self.project = { ...self.project, captures };
      await store.put(self.project);
    },
  };
  return self;
}

const EXPECTED_FAILS: Record<
  string,
  { category: string; checkType: string; kind: string; severity: string; viewport: string }
> = {
  'R-01': { category: 'presence', checkType: 'visual', kind: 'presence', severity: 'critical', viewport: 'desktop' },
  'R-02': { category: 'size', checkType: 'measured', kind: 'size', severity: 'major', viewport: 'desktop' },
  'R-03': {
    category: 'typography',
    checkType: 'measured',
    kind: 'dominant-text',
    severity: 'major',
    viewport: 'desktop',
  },
  'R-04': { category: 'content', checkType: 'measured', kind: 'count', severity: 'major', viewport: 'desktop' },
  'I-M-01': {
    category: 'responsive',
    checkType: 'measured',
    kind: 'layout-fits',
    severity: 'minor',
    viewport: 'mobile',
  },
  'R-06': { category: 'spacing', checkType: 'measured', kind: 'spacing', severity: 'minor', viewport: 'desktop' },
};

const statusOf = (run: Run, id: string) => run.results.find((r) => r.requirementId === id)?.status;

describe('sample acceptance: flawed implementation (SPEC-TEST-03, PRD-M-01, SPEC §4.8.8)', () => {
  it('PRD-M-01: defects 1-6 fail with the expected category, check type and severity; defect 7 needs review; nothing else is flagged', async () => {
    const r = await rig();
    await r.load('flawed');
    const run = await r.service.start(r.project.id, { settings, status: AVAILABLE }, () => undefined);
    const byId = new Map(r.contract.requirements.map((q) => [q.id, q]));

    for (const [id, want] of Object.entries(EXPECTED_FAILS)) {
      const q = byId.get(id);
      const f = run.results.find((x) => x.requirementId === id)?.finding;
      expect(f, id).toMatchObject({ status: 'fail', severity: want.severity, viewport: want.viewport });
      expect(q?.category, id).toBe(want.category);
      expect(q?.checkType, id).toBe(want.checkType);
      expect(q?.check.kind, id).toBe(want.kind);
    }
    expect(statusOf(run, 'R-07')).toBe('needs-review');
    // Zero Critical/Major false positives: the only failing items are the planted defects.
    const flagged = run.results
      .filter((x) => x.status === 'fail' || x.status === 'needs-review')
      .map((x) => x.requirementId)
      .sort();
    expect(flagged).toEqual(['I-M-01', 'R-01', 'R-02', 'R-03', 'R-04', 'R-06', 'R-07']);
    for (const id of ['R-05', 'R-08', 'I-M-02']) expect(statusOf(run, id), id).toBe('pass');
    expect(run.results.some((x) => x.status === 'not-checked')).toBe(false);
  });

  it('PRD-M-01: the Judged defect 7 is Needs review through the real AI path (device with images) and through the precomputed path (no device)', async () => {
    const live = await rig();
    await live.load('flawed');
    const a = await live.service.start(live.project.id, { settings, status: AVAILABLE }, () => undefined);
    expect(a.results.find((x) => x.requirementId === 'R-07')).toMatchObject({
      status: 'needs-review',
      engine: 'on-device',
    });
    expect(a.precomputed).toBe(false);

    const off = await rig(NO_DEVICE);
    await off.load('flawed');
    const events: string[] = [];
    const b = await off.service.start(
      off.project.id,
      { settings, status: NO_DEVICE, precomputed: assets.precomputed },
      (e) => events.push(e.kind),
    );
    expect(events).not.toContain('needs-consent');
    expect(off.ai.calls).toHaveLength(0);
    expect(b.precomputed).toBe(true);
    expect(b.results.find((x) => x.requirementId === 'R-07')).toMatchObject({
      status: 'needs-review',
      origin: 'precomputed',
    });
    expect(statusOf(b, 'R-01')).toBe('fail');
  });

  it('PRD-M-10: every Inferred Finding is Minor at most, labelled inferred and worded "Expected ... (inferred)"', async () => {
    const r = await rig();
    await r.load('flawed');
    const run = await r.service.start(r.project.id, { settings, status: AVAILABLE }, () => undefined);
    const inferred = r.service.findings(run).filter((f) => f.label === 'inferred');
    expect(inferred.length).toBeGreaterThan(0);
    for (const f of inferred) {
      expect(f.severity).toBe('minor');
      expect(f.statement).toMatch(/^Expected .*\(inferred\)/);
    }
  });

  it('PRD-M-03: every Measurement carries source tags, and the numbers are the measured ones', async () => {
    const r = await rig();
    await r.load('flawed');
    const run = await r.service.start(r.project.id, { settings, status: AVAILABLE }, () => undefined);
    const all = r.service.findings(run).flatMap((f) => f.evidence.measurements);
    expect(all.length).toBeGreaterThan(0);
    for (const m of all) expect(m.source.observed, m.name).toBeDefined();
    const size = run.results.find((x) => x.requirementId === 'R-02')?.finding;
    expect(size?.statement).toBe(
      'Primary CTA is 132 px wide vs 220 px in the design (−40.0%), measured from DOM snapshot.',
    );
    const gap = run.results.find((x) => x.requirementId === 'R-06')?.finding?.evidence.measurements[0];
    expect(gap).toMatchObject({ design: 96, observed: 64, deltaPct: -33.3 });
    const overflow = run.results.find((x) => x.requirementId === 'I-M-01')?.finding?.evidence.measurements[0];
    expect(overflow).toMatchObject({ observed: 64 });
  });

  it('PRD-M-09: running the unchanged captures again gives identical statuses and Measured/Visual results', async () => {
    const r = await rig();
    await r.load('flawed');
    const a = await r.service.start(r.project.id, { settings, status: AVAILABLE }, () => undefined);
    r.clock.advance(1000);
    const b = await r.service.start(r.project.id, { settings, status: AVAILABLE }, () => undefined);
    const strip = (run: Run) =>
      run.results.map(({ finding, ...rest }) => ({ ...rest, finding: finding && { ...finding, id: '' } }));
    expect(strip(b)).toEqual(strip(a));
    expect(b.changes && Object.values(b.changes).every((c) => c === 'remaining' || c === 'still-passing')).toBe(true);
  });

  it('SPEC-RUN-01: the Contract is locked after the Run is saved (SPEC-CON-06)', async () => {
    const r = await rig();
    await r.load('flawed');
    expect((await r.store.getContract(r.contract.id))?.locked).toBe(false);
    const run = await r.service.start(r.project.id, { settings, status: AVAILABLE }, () => undefined);
    expect(await r.store.getRun(run.id)).toBeDefined();
    expect((await r.store.getContract(r.contract.id))?.locked).toBe(true);
  });

  it('PRD-M-06, SPEC-RUN-12: Measured and Visual steps report 0 bytes sent; nothing is sent to the cloud on a device', async () => {
    const r = await rig();
    await r.load('flawed');
    const run = await r.service.start(r.project.id, { settings, status: AVAILABLE }, () => undefined);
    expect(run.trace.filter((s) => s.engine === 'measured').every((s) => s.bytesSent === 0)).toBe(true);
    expect(run.trace.some((s) => s.engine === 'cloud')).toBe(false);
  });
});

describe('sample acceptance: Re-verify with the fixed implementation (PRD-M-02)', () => {
  it('PRD-M-02: fixed vs flawed is 6 resolved, 1 remaining (R-06), 0 new, 0 regressed', async () => {
    const r = await rig();
    await r.load('flawed');
    const first = await r.service.start(r.project.id, { settings, status: AVAILABLE }, () => undefined);
    r.clock.advance(1000);
    await r.load('fixed');
    const second = await r.service.start(r.project.id, { settings, status: AVAILABLE }, () => undefined);
    expect(second.baselineRunId).toBe(first.id);
    const changes = second.changes ?? {};
    const of = (c: string) =>
      Object.entries(changes)
        .filter(([, v]) => v === c)
        .map(([k]) => k.split(':')[0])
        .sort();
    expect(of('resolved')).toEqual(['I-M-01', 'R-01', 'R-02', 'R-03', 'R-04', 'R-07']);
    expect(of('remaining')).toEqual(['R-06']);
    expect(of('new')).toEqual([]);
    expect(of('regressed')).toEqual([]);
    expect(r.service.summary(second).line).toBe('6 resolved, 1 remaining');
    expect(statusOf(second, 'R-06')).toBe('fail');
    expect(
      second.results.filter((x) => x.status === 'fail' || x.status === 'needs-review').map((x) => x.requirementId),
    ).toEqual(['R-06']);
    expect((await r.service.history(r.project.id)).map((h) => h.id)).toEqual([second.id, first.id]);
  });
});

describe('sample acceptance: Fix prompt (SPEC-TEST-03, S20, PRD-F-09)', () => {
  it('S20: the Fix prompt lists exactly the fail and needs-review Findings, the latter marked "verify first"', async () => {
    const r = await rig();
    await r.load('flawed');
    const run = await r.service.start(r.project.id, { settings, status: AVAILABLE }, () => undefined);
    const contract = (await r.store.getContract(r.contract.id)) as Contract;
    const findings = r.service.findings(run);
    const prompt = fixPrompt({ project: r.project, contract, run, findings });
    const items = prompt.split('\n').filter((l) => /^\d+\. \[/.test(l));
    expect(items).toHaveLength(7);
    for (const id of ['R-01', 'R-02', 'R-03', 'R-04', 'R-06', 'R-07', 'I-M-01']) {
      expect(
        items.filter((l) => l.includes(` ${id} `)),
        id,
      ).toHaveLength(1);
    }
    for (const id of ['R-05', 'R-08', 'I-M-02']) expect(prompt, id).not.toContain(` ${id} `);
    const verify = items.filter((l) => l.includes('verify first'));
    expect(verify).toHaveLength(1);
    expect(verify[0]).toContain(' R-07 ');
  });
});
