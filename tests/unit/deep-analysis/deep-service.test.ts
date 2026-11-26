import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type AiImage,
  type ConsentToken,
  CuiError,
  DEFAULT_RUNTIME_VALUES,
  type EngineStatus,
  type Finding,
  type ImageCodec,
  mintConsent,
  type Rect,
  type Run,
  type RuntimeConfig,
  type RuntimeValues,
  type Settings,
} from '@kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeAiEngine, type FakeAiConfig, type FakeAiEngine } from '../../../src/app/testing/fake-ai-engine';
import { createDeepService, type DeepService } from '../../../src/features/deep-analysis';
import { fixedClock } from '../../helpers/clock-ids';
import { InMemoryBlobStore, InMemoryProjectStore, InMemorySettingsStore } from '../../helpers/memory-stores';
import {
  capture,
  contract,
  designRef,
  evidence,
  finding,
  imageRef,
  measurement,
  project,
  requirement,
  requirementResult,
  run as sampleRun,
} from '../../helpers/samples';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/ai', `deep-analysis-${name}.json`), 'utf8'));

const DESKTOP = 'run-1:R-01:desktop';
const MOBILE = 'run-1:R-02:mobile';
const NEEDS = 'run-1:R-03:desktop';
const SURE = 'run-1:R-04:desktop';

const statusOf = (s: Partial<EngineStatus> = {}): EngineStatus => ({
  device: 'available',
  deviceImage: true,
  online: true,
  cloud: 'enabled',
  ...s,
});

const localDay = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const NOW = fixedClock().now();
const TODAY = localDay(NOW);

let store: InMemoryProjectStore;
let blobs: InMemoryBlobStore;
let settingsStore: InMemorySettingsStore;
let fakeCfg: FakeAiConfig;
let ai: FakeAiEngine;
let values: RuntimeValues;
let service: DeepService;
let cropMax: number[];

const codec = (): ImageCodec => ({
  async probe() {
    throw new Error('unused');
  },
  async normalise() {
    throw new Error('unused');
  },
  async pixels() {
    throw new Error('unused');
  },
  async crop(blob, r: Rect, maxSide, mime) {
    cropMax.push(maxSide);
    return { mime, base64: 'QUJD', bytes: 1000 + Math.round(r.w) + Math.round(r.h), role: 'design', blob };
  },
  async composePair(_d, dr: Rect, _c, cr: Rect, maxSide) {
    cropMax.push(maxSide);
    return { mime: 'image/png', base64: 'UEFJUg==', bytes: 500 + Math.round(dr.w + cr.w), role: 'pair' };
  },
});

const config: RuntimeConfig = { get: () => values, refresh: async () => undefined };
const consent = (runId = 'run-1'): ConsentToken => mintConsent({ scope: 'deep', runId }, { isTrusted: true });
const noop = () => undefined;

const mkFinding = (id: string, requirementId: string, over: Partial<Finding> = {}): Finding =>
  finding({
    id,
    requirementId,
    status: 'fail',
    severity: 'major',
    confidence: 'high',
    evidence: evidence({ measurements: [measurement()] }),
    ...over,
  });

const results = (...fs: Finding[]) =>
  fs.map((f) =>
    requirementResult({
      requirementId: f.requirementId,
      viewport: f.viewport,
      status: f.status,
      confidence: f.confidence,
      finding: f,
    }),
  );

async function seed(opts: { run?: Partial<Run>; findings?: Finding[]; settings?: Partial<Settings> } = {}) {
  const dBlob = await blobs.put(new Blob(['d'], { type: 'image/png' }));
  const cBlob = await blobs.put(new Blob(['c'], { type: 'image/png' }));
  const mkImg = (blobId: string, w: number) => imageRef({ blobId, width: w, cssWidth: w, height: 900 });
  await store.put(
    project({
      id: 'project-1',
      designs: [
        designRef({ id: 'd-desktop', viewport: 'desktop', image: mkImg(dBlob, 1440) }),
        designRef({ id: 'd-mobile', viewport: 'mobile', image: mkImg(dBlob, 390) }),
      ],
      captures: [
        capture({ id: 'cap-desktop', viewport: 'desktop', image: mkImg(cBlob, 1440) }),
        capture({ id: 'cap-mobile', viewport: 'mobile', image: mkImg(cBlob, 390) }),
      ],
    }),
  );
  await store.putContract(
    contract({
      requirements: [
        requirement({ id: 'R-01', accepted: true }),
        requirement({ id: 'R-02', viewport: 'mobile', accepted: true }),
        requirement({ id: 'R-03', accepted: true }),
        requirement({ id: 'R-04', accepted: true }),
        requirement({ id: 'R-05', accepted: false }),
      ],
    }),
  );
  const findings = opts.findings ?? [
    mkFinding(DESKTOP, 'R-01', { confidence: 'medium' }),
    mkFinding(MOBILE, 'R-02', { viewport: 'mobile', confidence: 'low' }),
    mkFinding(NEEDS, 'R-03', { status: 'needs-review', confidence: 'high', severity: 'minor' }),
    mkFinding(SURE, 'R-04', { confidence: 'high' }),
  ];
  const r = sampleRun({
    id: 'run-1',
    captureIds: ['cap-desktop', 'cap-mobile'],
    results: results(...findings),
    trace: [],
    ...opts.run,
  });
  await store.putRun(r);
  if (opts.settings) await settingsStore.write(opts.settings);
  return r;
}

beforeEach(() => {
  store = new InMemoryProjectStore();
  blobs = new InMemoryBlobStore();
  settingsStore = new InMemorySettingsStore();
  fakeCfg = {};
  ai = createFakeAiEngine(fakeCfg, {});
  values = { ...DEFAULT_RUNTIME_VALUES };
  cropMax = [];
  service = createDeepService({
    ai,
    config,
    store,
    blobs,
    codec: codec(),
    settings: settingsStore,
    clock: fixedClock(),
  });
});

describe('availability (SPEC-DEEP-03, SPEC-DEEP-04, PRD-F-06.3)', () => {
  it('SPEC-DEEP-04: ok when online, cloud on, under the cap, with something to refine', async () => {
    const r = await seed();
    expect(await service.availability(r, statusOf())).toEqual({ ok: true });
  });

  it('SPEC-DEEP-04: offline wins over every other reason', async () => {
    const r = await seed({ settings: { mode: 'on-device-only', deepUsage: { day: TODAY, count: 99 } } });
    expect(await service.availability(r, statusOf({ online: false, cloud: 'disabled' }))).toEqual({
      ok: false,
      reason: 'offline',
    });
  });

  it('SPEC-DEEP-04, S32: on-device-only mode blocks Deep Analysis', async () => {
    const r = await seed({ settings: { mode: 'on-device-only' } });
    expect(await service.availability(r, statusOf())).toEqual({ ok: false, reason: 'mode-on-device-only' });
  });

  it('SPEC-DEEP-04: cloud paused through the status or through cloud_enabled=false', async () => {
    const r = await seed();
    expect(await service.availability(r, statusOf({ cloud: 'disabled' }))).toEqual({
      ok: false,
      reason: 'cloud-disabled',
    });
    values = { ...values, cloud_enabled: false };
    expect(await service.availability(r, statusOf())).toEqual({ ok: false, reason: 'cloud-disabled' });
  });

  it('SPEC-DEEP-04: cap boundary, count = cap-1 allowed, count = cap blocked', async () => {
    const r = await seed({ settings: { deepUsage: { day: TODAY, count: values.deep_daily_cap - 1 } } });
    expect(await service.availability(r, statusOf())).toEqual({ ok: true });
    await settingsStore.write({ deepUsage: { day: TODAY, count: values.deep_daily_cap } });
    expect(await service.availability(r, statusOf())).toEqual({ ok: false, reason: 'daily-cap' });
  });

  it('SPEC-DEEP-04: a count from an earlier local day does not count; cap 0 blocks everything', async () => {
    const r = await seed({ settings: { deepUsage: { day: '2000-01-01', count: 99 } } });
    expect(await service.availability(r, statusOf())).toEqual({ ok: true });
    values = { ...values, deep_daily_cap: 0 };
    expect(await service.availability(r, statusOf())).toEqual({ ok: false, reason: 'daily-cap' });
  });

  it('SPEC-DEEP-03: nothing to refine when every Finding is a confident fail, and when there are none', async () => {
    const confident = await seed({ findings: [mkFinding(SURE, 'R-04', { confidence: 'high' })] });
    expect(await service.availability(confident, statusOf())).toEqual({ ok: false, reason: 'nothing-to-refine' });
    expect(await service.availability({ ...confident, results: [] }, statusOf())).toEqual({
      ok: false,
      reason: 'nothing-to-refine',
    });
  });

  it('SPEC-DEEP-03: needs-review at high confidence and fail at low confidence are targets', async () => {
    const r = await seed({ findings: [mkFinding(NEEDS, 'R-03', { status: 'needs-review', confidence: 'high' })] });
    expect(await service.availability(r, statusOf())).toEqual({ ok: true });
    const low = await seed({ findings: [mkFinding(MOBILE, 'R-02', { confidence: 'low', viewport: 'mobile' })] });
    expect(await service.availability(low, statusOf())).toEqual({ ok: true });
  });
});

describe('preview (SPEC-DEEP-02, SPEC-DEEP-03, SPEC-DEEP-05, PRD-F-06.1)', () => {
  it('SPEC-DEEP-02: lists design and capture per viewport, one pair per target, counts, model, cap', async () => {
    const r = await seed({ settings: { deepUsage: { day: TODAY, count: 3 } } });
    const p = await service.preview(r);
    expect(p.runId).toBe('run-1');
    expect(new Set(p.targets)).toEqual(new Set([DESKTOP, MOBILE, NEEDS]));
    expect(p.targets).not.toContain(SURE);
    expect(p.images).toHaveLength(2 * 2 + 3);
    expect(p.images.map((i) => i.label)).toEqual(
      expect.arrayContaining(['Desktop design', 'Desktop capture', 'Mobile design', 'Mobile capture']),
    );
    expect(p.images.every((i) => i.bytes > 0)).toBe(true);
    expect(p.contractItems).toBe(4); // accepted requirements only
    expect(p.measurements).toBe(3);
    expect(p.model).toBe(values.deep_model);
    expect(p.remaining).toEqual({ used: 3, cap: values.deep_daily_cap });
    expect(p.totalBytes).toBeGreaterThanOrEqual(p.images.reduce((n, i) => n + i.bytes, 0));
    expect(cropMax.every((m) => m === 1536)).toBe(true); // SPEC-AI-11 cloud max side
  });

  it('SPEC-DEEP-05: at most 8 targets, highest severity first', async () => {
    const many = Array.from({ length: 11 }, (_, i) =>
      mkFinding(`run-1:R-${i + 10}:desktop`, `R-${i + 10}`, {
        confidence: 'low',
        severity: i === 10 ? 'critical' : i % 2 ? 'major' : 'minor',
      }),
    );
    const r = await seed({ findings: many });
    const p = await service.preview(r);
    expect(p.targets).toHaveLength(8);
    expect(p.targets[0]).toBe('run-1:R-20:desktop'); // the critical one
    const rank = { critical: 0, major: 1, minor: 2 } as const;
    const ranks = p.targets.map((id) => rank[many.find((f) => f.id === id)?.severity ?? 'minor']);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(p.images.filter((i) => /side by side/i.test(i.label))).toHaveLength(8);
  });

  it('SPEC-DEEP-02: a missing capture drops its images without failing the preview', async () => {
    const r = await seed();
    const p = await service.preview({ ...r, captureIds: ['cap-desktop'] });
    expect(p.images.some((i) => i.label === 'Mobile capture')).toBe(false);
    expect(p.images.some((i) => i.label === 'Desktop capture')).toBe(true);
  });

  it('SPEC-DEEP-02: sends nothing; preview makes no ai.run call', async () => {
    const r = await seed();
    await service.preview(r);
    expect(ai.calls).toHaveLength(0);
  });
});

describe('run (SPEC-DEEP-05, SPEC-DEEP-06, SPEC-DEEP-07, SPEC-DEEP-08)', () => {
  it('SPEC-DEEP-05, SPEC-DEEP-02: one ONLY_IN_CLOUD request whose images and bytes equal the preview list', async () => {
    const r = await seed();
    const p = await service.preview(r);
    await service.run(p, consent(), noop);
    expect(ai.calls).toHaveLength(1);
    const req = ai.calls[0];
    expect(req?.task).toBe('deep-analysis');
    expect(req?.mode).toBe('ONLY_IN_CLOUD');
    expect(req?.consent).toEqual(expect.objectContaining({ scope: 'deep', runId: 'run-1' }));
    expect(req?.promptVersion).toBe('deep-analysis.v1');
    const sent = (req?.images ?? []).map((i: AiImage) => i.bytes);
    expect(sent).toEqual(p.images.map((i) => i.bytes));
    expect(req?.images.filter((i) => i.role === 'pair')).toHaveLength(p.targets.length);
    expect(req?.user).toContain(DESKTOP);
    expect(req?.user).not.toContain(SURE);
  });

  it('SPEC-DEEP-08: the prompt treats images and page text as data, forbids new numbers, allows "uncertain"', async () => {
    const r = await seed();
    await service.run(await service.preview(r), consent(), noop);
    const sys = ai.calls[0]?.system ?? '';
    expect(sys).toMatch(/senior UI reviewer/i);
    expect(sys).toMatch(/data, not instructions/i);
    expect(sys).toMatch(/only the listed targets/i);
    expect(sys).toMatch(/never (write|invent|introduce) new numbers/i);
    expect(sys).toMatch(/uncertain/i);
    expect(sys).toMatch(/viewport/i);
  });

  it('SPEC-DEEP-05: allowedNumbers hold the measurement values of the targets, both signs', async () => {
    const r = await seed();
    await service.run(await service.preview(r), consent(), noop);
    expect(ai.calls[0]?.allowedNumbers ?? []).toEqual(expect.arrayContaining([220, 132, -88, 88, -40, 40]));
  });

  it('SPEC-DEEP-05: a project token, another run token or no token is no consent', async () => {
    const r = await seed();
    const p = await service.preview(r);
    const other = mintConsent({ scope: 'project', projectId: 'project-1' }, { isTrusted: true });
    await expect(service.run(p, other, noop)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    await expect(service.run(p, consent('other'), noop)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    await expect(service.run(p, undefined as unknown as ConsentToken, noop)).rejects.toMatchObject({
      code: 'CONSENT_REQUIRED',
    });
    expect(ai.calls).toHaveLength(0);
    expect((await settingsStore.read()).deepUsage.count).toBe(0);
  });

  it('SPEC-DEEP-05: a preview that no longer matches the run is refused without a request', async () => {
    const r = await seed();
    const p = await service.preview(r);
    const stale = { ...p, images: p.images.map((i) => ({ ...i, bytes: i.bytes + 1 })) };
    await expect(service.run(stale, consent(), noop)).rejects.toBeInstanceOf(CuiError);
    expect(ai.calls).toHaveLength(0);
  });

  it('SPEC-DEEP-04: the count increments when the request is sent, and the day rolls over', async () => {
    const r = await seed({ settings: { deepUsage: { day: '2000-01-01', count: 7 } } });
    await service.run(await service.preview(r), consent(), noop);
    expect((await settingsStore.read()).deepUsage).toEqual({ day: TODAY, count: 1 });
    await service.run(await service.preview(r), consent(), noop);
    expect((await settingsStore.read()).deepUsage).toEqual({ day: TODAY, count: 2 });
  });

  it('SPEC-DEEP-04: the count increments even when the request then fails', async () => {
    const r = await seed();
    fakeCfg.errors = { 'deep-analysis': 'AI_FAILED' };
    await expect(service.run(await service.preview(r), consent(), noop)).rejects.toBeInstanceOf(CuiError);
    expect((await settingsStore.read()).deepUsage.count).toBe(1);
  });

  it('SPEC-DEEP-04: at the cap run refuses with DAILY_CAP and sends nothing', async () => {
    const r = await seed();
    const p = await service.preview(r);
    await settingsStore.write({ deepUsage: { day: TODAY, count: values.deep_daily_cap } });
    await expect(service.run(p, consent(), noop)).rejects.toMatchObject({ code: 'DAILY_CAP' });
    expect(ai.calls).toHaveLength(0);
  });

  it('SPEC-DEEP-04: offline and cloud-off refuse with OFFLINE / CLOUD_DISABLED before any request', async () => {
    const r = await seed();
    const p = await service.preview(r);
    fakeCfg.online = false;
    await expect(service.run(p, consent(), noop)).rejects.toMatchObject({ code: 'OFFLINE' });
    fakeCfg.online = true;
    fakeCfg.status = { cloud: 'disabled' };
    await expect(service.run(p, consent(), noop)).rejects.toMatchObject({ code: 'CLOUD_DISABLED' });
    expect(ai.calls).toHaveLength(0);
    expect((await settingsStore.read()).deepUsage.count).toBe(0);
  });

  it('SPEC-DEEP-06: updates status, confidence, fix, marks refinedBy cloud; measured numbers and severity stay', async () => {
    const r = await seed();
    fakeCfg.outputs = {
      'deep-analysis': {
        items: [
          {
            findingId: DESKTOP,
            status: 'needs-review',
            confidence: 'high',
            explanation: 'Both viewports share one button style.',
            suggestedFix: 'Fix the shared button width token.',
            crossViewportCause: 'Shared button style',
          },
        ],
      },
    };
    const seen: string[] = [];
    const out = await service.run(await service.preview(r), consent(), (s) => seen.push(s.step));
    const res = out.results.find((x) => x.requirementId === 'R-01');
    const before = r.results.find((x) => x.requirementId === 'R-01')?.finding;
    expect(res?.finding?.status).toBe('needs-review');
    expect(res?.finding?.confidence).toBe('high');
    expect(res?.finding?.suggestedFix).toBe('Fix the shared button width token.');
    expect(res?.finding?.refinedBy).toEqual({ engine: 'cloud', at: NOW });
    expect(res?.finding?.evidence).toEqual(before?.evidence);
    expect(res?.finding?.severity).toBe(before?.severity);
    expect(res?.finding?.statement).toBe(before?.statement);
    expect(res?.status).toBe('needs-review');
    expect(res?.hint).toContain('Both viewports share one button style.');
    expect(out.id).toBe(r.id);
    expect(seen).toEqual(['deep']);
  });

  it('SPEC-DEEP-06: pass removes the Finding and sets the result to pass', async () => {
    const r = await seed();
    fakeCfg.outputs = {
      'deep-analysis': {
        items: [
          { findingId: MOBILE, status: 'pass', confidence: 'high', explanation: 'Looks equal.', suggestedFix: '' },
        ],
      },
    };
    const out = await service.run(await service.preview(r), consent(), noop);
    const res = out.results.find((x) => x.requirementId === 'R-02');
    expect(res?.status).toBe('pass');
    expect(res?.finding).toBeUndefined();
    expect(res?.confidence).toBe('high');
    expect(out.results).toHaveLength(r.results.length);
  });

  it('SPEC-DEEP-06: unknown and non-target ids are ignored; a duplicate id uses the first item', async () => {
    const r = await seed();
    fakeCfg.outputs = {
      'deep-analysis': {
        items: [
          { findingId: 'run-1:nope:desktop', status: 'pass', confidence: 'high', explanation: 'x', suggestedFix: 'y' },
          { findingId: SURE, status: 'pass', confidence: 'high', explanation: 'x', suggestedFix: 'y' },
          { findingId: NEEDS, status: 'fail', confidence: 'medium', explanation: 'first', suggestedFix: 'first fix' },
          { findingId: NEEDS, status: 'pass', confidence: 'high', explanation: 'second', suggestedFix: 'second fix' },
        ],
      },
    };
    const out = await service.run(await service.preview(r), consent(), noop);
    expect(out.results.find((x) => x.requirementId === 'R-04')).toEqual(
      r.results.find((x) => x.requirementId === 'R-04'),
    );
    const n = out.results.find((x) => x.requirementId === 'R-03')?.finding;
    expect(n?.status).toBe('fail');
    expect(n?.suggestedFix).toBe('first fix');
  });

  it('SPEC-DEEP-06, SPEC-KERNEL-08: invented numbers keep the previous text; measured numbers pass', async () => {
    const r = await seed();
    fakeCfg.outputs = {
      'deep-analysis': {
        items: [
          {
            findingId: DESKTOP,
            status: 'fail',
            confidence: 'high',
            explanation: 'The CTA is 999 px wide.',
            suggestedFix: 'Set it to 123 px.',
          },
          {
            findingId: NEEDS,
            status: 'fail',
            confidence: 'high',
            explanation: 'It is 132 px, not 220 px.',
            suggestedFix: 'Make it 220 px wide.',
          },
        ],
      },
    };
    const out = await service.run(await service.preview(r), consent(), noop);
    const guarded = out.results.find((x) => x.requirementId === 'R-01');
    expect(guarded?.finding?.suggestedFix).toBe(r.results[0]?.finding?.suggestedFix);
    expect(guarded?.hint ?? '').not.toContain('999');
    expect(guarded?.finding?.refinedBy).toBeDefined();
    expect(out.results.find((x) => x.requirementId === 'R-03')?.finding?.suggestedFix).toBe('Make it 220 px wide.');
    expect(out.trace.at(-1)?.note).toMatch(/numberGuardTripped: [1-9]/);
  });

  it('SPEC-DEEP-06: an Inferred finding stays minor and keeps its measurements', async () => {
    const inferred = mkFinding('run-1:I-M-01:mobile', 'I-M-01', {
      viewport: 'mobile',
      label: 'inferred',
      severity: 'minor',
      confidence: 'low',
    });
    const r = await seed({ findings: [inferred] });
    fakeCfg.outputs = {
      'deep-analysis': {
        items: [
          { findingId: inferred.id, status: 'fail', confidence: 'high', explanation: 'Bad.', suggestedFix: 'Fix it.' },
        ],
      },
    };
    const out = await service.run(await service.preview(r), consent(), noop);
    const f = out.results[0]?.finding;
    expect(f?.severity).toBe('minor');
    expect(f?.label).toBe('inferred');
    expect(f?.evidence.measurements).toEqual(inferred.evidence.measurements);
  });

  it('SPEC-DEEP-06: the saved Run keeps its id, gains one deep Cloud step with bytes > 0, and is stored', async () => {
    const r = await seed({ run: { trace: [{ step: 'run', engine: 'measured', durationMs: 5, bytesSent: 0 }] } });
    fakeCfg.durationMs = 42;
    const out = await service.run(await service.preview(r), consent(), noop);
    expect(out.trace).toHaveLength(2);
    const step = out.trace.at(-1);
    expect(step).toMatchObject({
      step: 'deep',
      engine: 'cloud',
      durationMs: 42,
      requestedMode: 'ONLY_IN_CLOUD',
      promptVersion: 'deep-analysis.v1',
      model: values.deep_model,
    });
    expect(step?.bytesSent).toBeGreaterThan(0);
    expect(await store.getRun('run-1')).toEqual(out);
  });

  it('SPEC-DEEP-07: QUOTA_EXCEEDED, APPCHECK_FAILED, AI_FAILED leave the stored Run unchanged', async () => {
    for (const code of ['QUOTA_EXCEEDED', 'APPCHECK_FAILED', 'AI_FAILED'] as const) {
      const r = await seed();
      fakeCfg.errors = { 'deep-analysis': code };
      await expect(service.run(await service.preview(r), consent(), noop)).rejects.toMatchObject({ code });
      expect(await store.getRun('run-1')).toEqual(r);
    }
  });

  it('SPEC-DEEP-07: a non-CuiError becomes AI_FAILED', async () => {
    const r = await seed();
    const boom = {
      status: async () => statusOf(),
      downloadDeviceModel: async () => statusOf(),
      run: async () => Promise.reject(new Error('sdk text')),
    };
    const svc = createDeepService({
      ai: boom,
      config,
      store,
      blobs,
      codec: codec(),
      settings: settingsStore,
      clock: fixedClock(),
    });
    await expect(svc.run(await svc.preview(r), consent(), noop)).rejects.toMatchObject({ code: 'AI_FAILED' });
    expect(await store.getRun('run-1')).toEqual(r);
  });

  it('SPEC-DEEP-07, SPEC-AI-06: malformed output is retried once, then AI_BAD_OUTPUT with the Run unchanged', async () => {
    const r = await seed();
    fakeCfg.outputs = { 'deep-analysis': fixture('malformed') };
    await expect(service.run(await service.preview(r), consent(), noop)).rejects.toMatchObject({
      code: 'AI_BAD_OUTPUT',
    });
    expect(ai.calls).toHaveLength(2);
    expect(await store.getRun('run-1')).toEqual(r);
  });

  it('SPEC-DEEP-06: a valid answer after a malformed first one is merged', async () => {
    const r = await seed();
    fakeCfg.outputs = { 'deep-analysis': { sequence: [fixture('malformed'), { items: [] }] } };
    const out = await service.run(await service.preview(r), consent(), noop);
    expect(ai.calls).toHaveLength(2);
    expect(out.trace.at(-1)?.step).toBe('deep');
  });

  it('SPEC-DEEP-06: the invented-numbers fixture never writes its numbers into a Finding', async () => {
    const r = await seed();
    fakeCfg.outputs = { 'deep-analysis': fixture('invented-numbers') };
    const out = await service.run(await service.preview(r), consent(), noop);
    const text = JSON.stringify(out.results);
    expect(text).not.toContain('310');
    expect(text).not.toContain('14 px');
  });
});

describe('applyPrecomputed (SPEC-DEMO-05, SPEC-DEEP-06)', () => {
  it('SPEC-DEMO-05: merges with origin precomputed, makes no ai.run call and does not count', async () => {
    const r = await seed({ settings: { deepUsage: { day: TODAY, count: 2 } } });
    const out = await service.applyPrecomputed(r, {
      items: [
        {
          findingId: DESKTOP,
          status: 'needs-review',
          confidence: 'high',
          explanation: 'Shared style.',
          suggestedFix: 'Fix the shared width.',
        },
        { findingId: MOBILE, status: 'pass', confidence: 'high', explanation: 'Fine.', suggestedFix: '' },
        { findingId: 'run-1:unknown:desktop', status: 'pass', confidence: 'high', explanation: 'x', suggestedFix: 'y' },
      ],
    });
    expect(ai.calls).toHaveLength(0);
    expect((await settingsStore.read()).deepUsage).toEqual({ day: TODAY, count: 2 });
    expect(out.precomputed).toBe(true);
    const f = out.results.find((x) => x.requirementId === 'R-01');
    expect(f?.origin).toBe('precomputed');
    expect(f?.finding?.origin).toBe('precomputed');
    expect(f?.finding?.refinedBy?.engine).toBe('cloud');
    expect(f?.finding?.suggestedFix).toBe('Fix the shared width.');
    const passed = out.results.find((x) => x.requirementId === 'R-02');
    expect(passed?.status).toBe('pass');
    expect(passed?.origin).toBe('precomputed');
    expect(out.results.find((x) => x.requirementId === 'R-04')?.origin).toBe('ai');
    expect(await store.getRun('run-1')).toEqual(out);
  });

  it('SPEC-DEMO-05: an empty list changes only the precomputed flag; the valid fixture applies', async () => {
    const r = await seed();
    const none = await service.applyPrecomputed(r, { items: [] });
    expect(none.results).toEqual(r.results);
    expect(none.precomputed).toBe(true);
    const out = await service.applyPrecomputed(r, fixture('valid'));
    expect(out.results).toHaveLength(r.results.length);
  });
});
