import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type AiTask,
  type ConsentToken,
  type Contract,
  CuiError,
  DEFAULT_RUNTIME_VALUES,
  type EngineStatus,
  type ErrorCode,
  type ImageCodec,
  type MeasureClient,
  mintConsent,
  type Rect,
  type RuntimeConfig,
  type Settings,
  type TraceStep,
} from '@kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeAiEngine, type FakeAiConfig, type FakeAiEngine } from '../../../src/app/testing/fake-ai-engine';
import { type ContractService, createContractService, type ExtractOutcome } from '../../../src/features/contract';
import { fixedClock, sequentialIds } from '../../helpers/clock-ids';
import { InMemoryBlobStore, InMemoryProjectStore } from '../../helpers/memory-stores';
import { contract, designRef, imageRef, project, requirement, settings } from '../../helpers/samples';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/ai', `extract-contract-${name}.json`), 'utf8'));
const valid = fixture('valid');
const malformed = fixture('malformed');
const invented = fixture('invented-numbers');

const PID = 'project-1';
const statusOf = (s: Partial<EngineStatus> = {}): EngineStatus => ({
  device: 'available',
  deviceImage: true,
  online: true,
  cloud: 'enabled',
  ...s,
});
const consent = (): ConsentToken => mintConsent({ scope: 'project', projectId: PID }, { isTrusted: true });

let store: InMemoryProjectStore;
let blobs: InMemoryBlobStore;
let fakeCfg: FakeAiConfig;
let ai: FakeAiEngine;
let crops: Rect[];
let measureRects: (r: Rect) => { rect: Rect; iou: number } | { unresolved: true };
let svc: ContractService;

const codec = (): ImageCodec => ({
  async probe() {
    throw new Error('unused');
  },
  async normalise() {
    throw new Error('unused');
  },
  async pixels() {
    return { width: 1, height: 1, data: new Uint8ClampedArray(4) };
  },
  async crop(blob, r, maxSide, mime) {
    crops.push(r);
    return { mime, base64: 'QUJD', bytes: 1000 + maxSide, role: 'design', blob };
  },
  async composePair() {
    throw new Error('unused');
  },
});

const measure = {
  snapRegion: async (_img: unknown, r: Rect) => measureRects(r),
} as unknown as MeasureClient;

const config: RuntimeConfig = { get: () => DEFAULT_RUNTIME_VALUES, refresh: async () => undefined };

async function seed(opts: { designs?: ('desktop' | 'mobile')[]; height?: number; isSample?: boolean } = {}) {
  const designs = [];
  for (const v of opts.designs ?? ['desktop']) {
    const w = v === 'desktop' ? 1440 : 390;
    const blobId = await blobs.put(new Blob(['x'], { type: 'image/png' }));
    designs.push(
      designRef({
        id: `d-${v}`,
        viewport: v,
        image: imageRef({ blobId, width: w, cssWidth: w, height: opts.height ?? 1000 }),
      }),
    );
  }
  await store.put(project({ id: PID, designs, captures: [], isSample: opts.isSample ?? false }));
}

async function patchProject(patch: object) {
  const p = await store.get(PID);
  if (!p) throw new Error('no project');
  await store.put({ ...p, ...patch });
}

const ctx = (over: { status?: Partial<EngineStatus>; mode?: Settings['mode']; consent?: ConsentToken } = {}) => ({
  settings: settings({ mode: over.mode ?? 'auto' }),
  status: statusOf(over.status),
  ...(over.consent && { projectConsent: over.consent }),
});

const extract = (o: Parameters<typeof ctx>[0] = {}, steps: TraceStep[] = []) =>
  svc.extract(PID, ctx(o), (s) => steps.push(s));
const done = (o: ExtractOutcome): Contract => {
  if (o.kind !== 'done') throw new Error(`expected done, got ${o.kind}`);
  return o.contract;
};
const calls = (task: AiTask = 'extract-contract') => ai.calls.filter((c) => c.task === task);

beforeEach(() => {
  store = new InMemoryProjectStore();
  blobs = new InMemoryBlobStore();
  crops = [];
  measureRects = (r) => ({ rect: r, iou: 1 });
  fakeCfg = { status: 'available+image', outputs: { 'extract-contract': valid } };
  ai = createFakeAiEngine(fakeCfg, {});
  svc = createContractService({
    ai,
    config,
    store,
    blobs,
    codec: codec(),
    clock: fixedClock(),
    ids: sequentialIds('c'),
    measure,
  });
});

describe('SPEC-CON-01 bands and calls', () => {
  it('SPEC-CON-01: desktop bands are round(width*0.6) tall, last shorter, no overlap, one call each, in order', async () => {
    await seed({ height: 1000 });
    await extract();
    expect(crops).toEqual([
      { x: 0, y: 0, w: 1440, h: 864 },
      { x: 0, y: 864, w: 1440, h: 136 },
    ]);
    expect(calls()).toHaveLength(2);
  });

  it('SPEC-CON-01: mobile bands are round(width*1.6) tall', async () => {
    await seed({ designs: ['mobile'], height: 1000 });
    await extract();
    expect(crops).toEqual([
      { x: 0, y: 0, w: 390, h: 624 },
      { x: 0, y: 624, w: 390, h: 376 },
    ]);
  });

  it('SPEC-CON-01: a design shorter than one band is a single band', async () => {
    await seed({ height: 500 });
    await extract();
    expect(crops).toEqual([{ x: 0, y: 0, w: 1440, h: 500 }]);
  });

  it('SPEC-CON-01, SPEC-AI-11: on-device bands are cropped to 1024 px JPEG', async () => {
    await seed({ height: 500 });
    await extract();
    const [c] = calls();
    expect(c?.mode).toBe('ONLY_ON_DEVICE');
    expect(c?.images).toHaveLength(1);
    expect(c?.images[0]?.mime).toBe('image/jpeg');
    expect(c?.images[0]?.bytes).toBe(1000 + 1024);
    expect(c?.promptVersion).toMatch(/extract-contract/);
  });

  it('SPEC-CON-01, SPEC-AI-11: cloud-only mode crops at 1536 px', async () => {
    await seed({ height: 500 });
    await extract({ mode: 'cloud-only', consent: consent() });
    expect(calls()[0]?.mode).toBe('ONLY_IN_CLOUD');
    expect(calls()[0]?.images[0]?.bytes).toBe(1000 + 1536);
  });

  it('SPEC-CON-01: bands run sequentially (a call starts only after the previous resolved)', async () => {
    await seed({ height: 1000 });
    let inFlight = 0;
    let maxInFlight = 0;
    const real = ai.run.bind(ai);
    ai.run = async (req, sig) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      try {
        return await real(req, sig);
      } finally {
        inFlight--;
      }
    };
    await extract();
    expect(maxInFlight).toBe(1);
  });

  it('SPEC-SEC-07, SPEC-CON-02: the prompt names viewport and width and treats image text as data', async () => {
    await seed({ height: 500 });
    await extract();
    const c = calls()[0];
    expect(c?.system).toMatch(/not instructions/i);
    expect(`${c?.system}${c?.user}`).toMatch(/desktop/);
    expect(c?.user).toMatch(/1440/);
    expect(c?.user).toContain('<<<DATA');
    expect(c?.user).toContain('DATA>>>');
  });
});

describe('SPEC-CON-01 mapping', () => {
  it('SPEC-CON-01, SPEC-CON-09: fixture boxes become CSS-px rects (band offset applied), ids R-nn, engine labels', async () => {
    await seed({ height: 500 });
    const c = done(await extract());
    expect(c.version).toBe(1);
    expect(c.locked).toBe(false);
    expect(c.requirements.map((r) => r.id)).toEqual(['R-01', 'R-02', 'R-03']);
    // document order: nav count box (y 20..70), hero h1 (200..320), CTA (640..700) of a 500 px band
    expect(c.requirements[0]?.check.kind).toBe('count');
    expect(c.requirements[1]?.check.kind).toBe('text');
    const cta = c.requirements.find((r) => r.category === 'size');
    expect(cta?.id).toBe('R-03');
    expect(cta?.region).toMatchObject({ source: 'snapped' });
    const r0 = cta?.region && 'rect' in cta.region ? cta.region.rect : undefined;
    expect(r0?.x).toBeCloseTo(172.8, 5);
    expect(r0?.y).toBeCloseTo(320, 5);
    expect(r0?.w).toBeCloseTo(259.2, 5);
    expect(r0?.h).toBeCloseTo(30, 5);
    for (const r of c.requirements) {
      expect(r.origin).toBe('ai');
      expect(r.engine).toBe('on-device');
      expect(r.accepted).toBe(false);
      expect(r.label).toBe('explicit');
      expect(r.viewport).toBe('desktop');
    }
  });

  it('SPEC-CON-01: second band boxes are offset by the band top', async () => {
    await seed({ height: 1000 });
    fakeCfg.outputs = {
      'extract-contract': { sequence: [{ requirements: [] }, { requirements: [valid.requirements[0]] }] },
    };
    const c = done(await extract());
    // band 2 is 136 px tall at y 864; box y 640..700 -> 864 + 0.64 * 136
    const region = c.requirements[0]?.region;
    expect(region && 'rect' in region ? region.rect.y : -1).toBeCloseTo(951.04, 1);
  });

  it('SPEC-MEAS-07, SPEC-CON-07: unresolved snap keeps the suggested rect', async () => {
    await seed({ height: 500 });
    measureRects = () => ({ unresolved: true });
    const c = done(await extract());
    expect(c.requirements[0]?.region).toMatchObject({ unresolved: true, suggested: { x: expect.any(Number) } });
  });

  it('SPEC-CON-01: snapped rect replaces the suggested one', async () => {
    await seed({ height: 500 });
    measureRects = () => ({ rect: { x: 1, y: 2, w: 3, h: 4 }, iou: 0.9 });
    const c = done(await extract());
    expect(c.requirements[0]?.region).toEqual({ rect: { x: 1, y: 2, w: 3, h: 4 }, source: 'snapped' });
  });

  it('SPEC-CON-01: checkKind, matchHint and expected values map to CheckSpec and checkType', async () => {
    await seed({ height: 500 });
    const c = done(await extract());
    const size = c.requirements.find((r) => r.category === 'size');
    expect(size?.check).toEqual({ kind: 'size', match: { tag: 'button', text: 'Start free' }, dimension: 'width' });
    expect(size?.checkType).toBe('measured');
    expect(size?.primary).toBe(true);
    const text = c.requirements.find((r) => r.check.kind === 'text');
    expect(text?.check).toEqual({ kind: 'text', match: { tag: 'h1' }, expected: 'Build faster' });
    const count = c.requirements.find((r) => r.check.kind === 'count');
    expect(count?.check).toEqual({ kind: 'count', match: { role: 'navigation' }, expected: 3 });
  });

  const kindCase = (checkKind: string, hint: object, expectType: string, expectKind: string) =>
    it(`SPEC-CON-01: ${checkKind} with hint ${JSON.stringify(hint)} -> ${expectType}/${expectKind}`, async () => {
      await seed({ height: 500 });
      fakeCfg.outputs = {
        'extract-contract': {
          requirements: [
            { ...valid.requirements[0], checkKind, matchHint: hint, statement: 'Item', condition: 'Item ok' },
          ],
        },
      };
      const r = done(await extract()).requirements[0];
      expect(r?.checkType).toBe(expectType);
      expect(r?.check.kind).toBe(expectKind);
    });
  kindCase('region-diff', {}, 'visual', 'region-diff');
  kindCase('judged', {}, 'judged', 'judged');
  kindCase('position', { tag: 'h1' }, 'judged', 'position');
  kindCase('colour', { tag: 'h1' }, 'measured', 'colour');
  kindCase('presence', {}, 'visual', 'presence');
  kindCase('presence', { tag: 'nav' }, 'measured', 'presence');
  kindCase('layout-fits', {}, 'measured', 'layout-fits');
  kindCase('dominant-text', { tag: 'h1' }, 'measured', 'dominant-text');
  kindCase('count', { tag: 'li' }, 'judged', 'judged'); // no expectedCount: nothing to measure against

  it('SPEC-CON-01, S7: expected count/text are proposals, not accepted', async () => {
    await seed({ height: 500 });
    const c = done(await extract());
    expect(c.requirements.every((r) => r.accepted === false)).toBe(true);
  });

  it('SPEC-CON-01: boxes with swapped or collapsed corners still give a positive rect', async () => {
    await seed({ height: 500 });
    fakeCfg.outputs = {
      'extract-contract': {
        requirements: [
          { ...valid.requirements[0], box: [500, 500, 100, 100] },
          { ...valid.requirements[1], box: [10, 10, 10, 10] },
        ],
      },
    };
    measureRects = () => ({ unresolved: true });
    const c = done(await extract());
    expect(c.requirements).toHaveLength(2);
    for (const r of c.requirements) {
      const reg = r.region;
      const rect = reg && 'rect' in reg ? reg.rect : reg && 'suggested' in reg ? reg.suggested : undefined;
      expect(rect?.w).toBeGreaterThan(0);
      expect(rect?.h).toBeGreaterThan(0);
    }
  });

  it('SPEC-CON-01: dedupe keeps the first of same-category boxes with IoU >= 0.6, keeps other categories', async () => {
    await seed({ height: 500 });
    const a = { ...valid.requirements[0], box: [100, 100, 300, 200] };
    fakeCfg.outputs = {
      'extract-contract': {
        requirements: [
          { ...a, statement: 'First', condition: 'First ok' },
          { ...a, box: [105, 102, 305, 202], statement: 'Duplicate', condition: 'Dup ok' },
          { ...a, category: 'content', statement: 'Other category', condition: 'Other ok' },
          { ...a, box: [600, 100, 800, 200], statement: 'Far away', condition: 'Far ok' },
        ],
      },
    };
    const c = done(await extract());
    expect(c.requirements.map((r) => r.statement).sort()).toEqual(['Far away', 'First', 'Other category']);
  });

  it('SPEC-CON-01: total is capped at MAX_REQUIREMENTS (60)', async () => {
    await seed({ height: 20_000 });
    const mk = (i: number) => ({
      ...valid.requirements[0],
      category: 'content',
      box: [0, i * 120, 100, i * 120 + 100],
      statement: `Item ${i}`,
      condition: `Cond ${i}`,
    });
    fakeCfg.outputs = { 'extract-contract': { requirements: Array.from({ length: 8 }, (_, i) => mk(i)) } };
    const c = done(await extract());
    expect(c.requirements).toHaveLength(60);
    expect(c.requirements.at(-1)?.id).toBe('R-60');
  });

  it('SPEC-CON-01: more than 8 requirements in one band is bad output for that band', async () => {
    await seed({ height: 500 });
    fakeCfg.outputs = {
      'extract-contract': { requirements: Array.from({ length: 9 }, () => valid.requirements[0]) },
    };
    const c = done(await extract());
    expect(c.requirements).toHaveLength(0);
    expect(c.extraction?.some((s) => /Band 1 could not be read/.test(s.note ?? ''))).toBe(true);
  });

  it('SPEC-CON-01: empty requirements is a valid, empty result with a trace step', async () => {
    await seed({ height: 500 });
    fakeCfg.outputs = { 'extract-contract': { requirements: [] } };
    const c = done(await extract());
    expect(c.requirements).toEqual([]);
    expect(c.extraction).toHaveLength(1);
  });

  it('SPEC-CON-01: ids follow document order across viewports (desktop first)', async () => {
    await seed({ designs: ['mobile', 'desktop'], height: 400 });
    const c = done(await extract());
    expect(c.requirements.map((r) => r.id)).toEqual(['R-01', 'R-02', 'R-03', 'R-04', 'R-05', 'R-06']);
    expect(c.requirements.map((r) => r.viewport)).toEqual([
      'desktop',
      'desktop',
      'desktop',
      'mobile',
      'mobile',
      'mobile',
    ]);
  });
});

describe('SPEC-KERNEL-08 numbers', () => {
  it('SPEC-KERNEL-08, SPEC-CON-02: invented numbers in statement and condition are replaced by a template', async () => {
    await seed({ height: 500 });
    fakeCfg.outputs = { 'extract-contract': invented };
    const c = done(await extract());
    const r = c.requirements[0];
    expect(r?.statement).not.toMatch(/\d/);
    expect(r?.condition).not.toMatch(/\d/);
    expect(r?.statement.length).toBeGreaterThan(0);
    expect(c.extraction?.some((s) => /numberGuardTripped/.test(s.note ?? ''))).toBe(true);
  });

  it('SPEC-KERNEL-08: the expectedCount number stays in the statement', async () => {
    await seed({ height: 500 });
    const c = done(await extract());
    expect(c.requirements.find((r) => r.check.kind === 'count')?.statement).toBe('Navigation shows 3 links');
  });

  it('SPEC-KERNEL-08: a count statement with another number is replaced', async () => {
    await seed({ height: 500 });
    fakeCfg.outputs = {
      'extract-contract': { requirements: [{ ...valid.requirements[2], statement: 'Navigation shows 7 links' }] },
    };
    const c = done(await extract());
    expect(c.requirements[0]?.statement).not.toContain('7');
  });
});

describe('SPEC-CON-01 failures', () => {
  it('SPEC-CON-01, PRD-P-09: malformed output twice -> band notice, other bands kept', async () => {
    await seed({ height: 1000 });
    fakeCfg.outputs = { 'extract-contract': { sequence: [malformed, malformed, valid] } };
    const c = done(await extract());
    expect(c.requirements).toHaveLength(3);
    const notes = (c.extraction ?? []).map((s) => s.note).filter(Boolean);
    expect(notes).toContain('Band 1 could not be read. Add requirements manually.');
    expect(calls()).toHaveLength(3);
  });

  it('SPEC-AI-06: malformed once then valid -> retried with the JSON reminder, no notice', async () => {
    await seed({ height: 500 });
    fakeCfg.outputs = { 'extract-contract': { sequence: [malformed, valid] } };
    const c = done(await extract());
    expect(c.requirements).toHaveLength(3);
    expect(calls()[1]?.user).toContain('Return only valid JSON matching the schema.');
    expect((c.extraction ?? []).some((s) => /could not be read/.test(s.note ?? ''))).toBe(false);
  });

  it('SPEC-CON-01: AI_BAD_OUTPUT from the engine is a band notice, not a failure of the whole extract', async () => {
    await seed({ height: 1000 });
    let n = 0;
    const real = ai.run.bind(ai);
    ai.run = async (req, sig) => {
      if (n++ === 0) throw new CuiError('AI_BAD_OUTPUT');
      return real(req, sig);
    };
    const c = done(await extract());
    expect(c.requirements).toHaveLength(3);
    expect((c.extraction ?? []).some((s) => /Band 1 could not be read/.test(s.note ?? ''))).toBe(true);
  });

  const blockedCases: [ErrorCode, string][] = [
    ['OFFLINE', 'offline'],
    ['CLOUD_DISABLED', 'cloud-disabled'],
    ['DEVICE_UNAVAILABLE', 'device-unavailable'],
    ['DEVICE_DOWNLOADING', 'device-unavailable'],
    ['DEVICE_NO_IMAGE', 'device-unavailable'],
    ['QUOTA_EXCEEDED', 'ai-failed'],
    ['AI_FAILED', 'ai-failed'],
    ['AI_BLOCKED', 'ai-failed'],
    ['APPCHECK_FAILED', 'ai-failed'],
    ['AI_NOT_ENABLED', 'ai-failed'],
  ];
  for (const [code, reason] of blockedCases) {
    it(`SPEC-CON-01, SPEC-AI-10: ${code} stops extraction as blocked ${reason}, saves nothing`, async () => {
      await seed({ height: 1000 });
      fakeCfg.errors = { 'extract-contract': code };
      const out = await extract();
      expect(out).toMatchObject({ kind: 'blocked', reason });
      if (out.kind === 'blocked') expect(out.contract.requirements.filter((r) => r.origin === 'ai')).toHaveLength(0);
      expect(calls()).toHaveLength(1); // no point asking the next band
      expect(await svc.active(PID)).toBeUndefined();
    });
  }

  it('SPEC-CON-01: a project without designs is an error, not an empty Contract', async () => {
    await store.put(project({ id: PID, designs: [], captures: [] }));
    await expect(extract()).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });

  it('SPEC-CON-01: unknown project -> STORAGE_FAILED', async () => {
    await expect(svc.extract('nope', ctx(), () => undefined)).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });

  it('SPEC-CON-01: a missing design blob -> STORAGE_FAILED', async () => {
    await seed({ height: 500 });
    await blobs.remove('blob-1');
    await expect(extract()).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });
});

describe('SPEC-CON-01 consent and mode (PRD-M-06, PRD-H-05)', () => {
  it('PRD-M-06, SPEC-CON-01: text-only device without consent -> needs-consent with a SendList and zero ai.run calls', async () => {
    await seed({ height: 1000 });
    const out = await extract({ status: { deviceImage: false, reason: 'image-flag-off' } });
    expect(out.kind).toBe('needs-consent');
    if (out.kind !== 'needs-consent') return;
    expect(out.plan).toEqual({ kind: 'needs-consent', why: 'device-no-image' });
    expect(out.sends.images).toHaveLength(2);
    expect(out.sends.images[0]).toMatchObject({ bytes: expect.any(Number) });
    expect(out.sends.images[0]?.label).toMatch(/desktop/i);
    expect(out.sends.text.join(' ')).toMatch(/not instructions/i);
    expect(ai.calls).toHaveLength(0);
    expect(await svc.active(PID)).toBeUndefined();
  });

  it('PRD-M-06: device unavailable, downloading and cloud-only without consent all make zero calls', async () => {
    await seed({ height: 500 });
    for (const status of [{ device: 'unavailable' as const }, { device: 'downloading' as const }]) {
      expect((await extract({ status })).kind).toBe('needs-consent');
    }
    expect((await extract({ mode: 'cloud-only' })).kind).toBe('needs-consent');
    expect(ai.calls).toHaveLength(0);
  });

  it('PRD-M-06: a consent token for another project is no consent', async () => {
    await seed({ height: 500 });
    const other = mintConsent({ scope: 'project', projectId: 'other' }, { isTrusted: true });
    const out = await extract({ status: { deviceImage: false }, consent: other });
    expect(out.kind).toBe('needs-consent');
    expect(ai.calls).toHaveLength(0);
  });

  it('SPEC-CON-01: with consent and no image support the call goes PREFER_ON_DEVICE with the token (cloud bytes traced)', async () => {
    await seed({ height: 500 });
    const steps: TraceStep[] = [];
    fakeCfg.status = 'available-text-only';
    const c = done(await extract({ status: { deviceImage: false }, consent: consent() }, steps));
    expect(calls()[0]?.mode).toBe('PREFER_ON_DEVICE');
    expect(calls()[0]?.consent?.scope).toBe('project');
    expect(calls()[0]?.images[0]?.bytes).toBe(1000 + 1536);
    expect(c.requirements.every((r) => r.engine === 'cloud')).toBe(true);
    expect(steps[0]).toMatchObject({ engine: 'cloud', requestedMode: 'PREFER_ON_DEVICE' });
    expect(steps[0]?.bytesSent).toBeGreaterThan(0);
  });

  it('SPEC-CON-01: offline without a usable device -> blocked offline, zero calls', async () => {
    await seed({ height: 500 });
    const out = await extract({ status: { online: false, deviceImage: false }, consent: consent() });
    expect(out).toMatchObject({ kind: 'blocked', reason: 'offline' });
    expect(ai.calls).toHaveLength(0);
  });

  it('SPEC-KERNEL-06: cloud disabled with consent and no device -> blocked cloud-disabled', async () => {
    await seed({ height: 500 });
    const out = await extract({ status: { cloud: 'disabled', device: 'unavailable' }, consent: consent() });
    expect(out).toMatchObject({ kind: 'blocked', reason: 'cloud-disabled' });
    expect(ai.calls).toHaveLength(0);
  });

  it('SPEC-KERNEL-06 [P1]: on-device-only setting never sends a consent token', async () => {
    await seed({ height: 500 });
    await extract({ mode: 'on-device-only', consent: consent() });
    expect(calls()[0]?.mode).toBe('ONLY_ON_DEVICE');
    expect(calls()[0]?.consent).toBeUndefined();
  });
});

describe('SPEC-CON-01 trace and progress', () => {
  it('SPEC-CON-01: each call appends a TraceStep (engine, duration, bytes, mode, prompt version) and reports progress', async () => {
    await seed({ height: 1000 });
    fakeCfg.durationMs = 7;
    const steps: TraceStep[] = [];
    const c = done(await extract({}, steps));
    expect(c.extraction).toHaveLength(2);
    expect(steps).toEqual(c.extraction);
    expect(steps[0]).toMatchObject({
      engine: 'on-device',
      durationMs: 7,
      bytesSent: 0,
      requestedMode: 'ONLY_ON_DEVICE',
      promptVersion: expect.stringContaining('extract-contract'),
    });
    expect(steps[0]?.step).toMatch(/desktop/);
  });
});

describe('SPEC-CON-09 output versioning', () => {
  it('SPEC-CON-09: new Contract is saved v1, unlocked, and becomes active', async () => {
    await seed({ height: 500 });
    const c = done(await extract());
    expect(await svc.active(PID)).toEqual(c);
    expect((await store.get(PID))?.activeContractId).toBe(c.id);
  });

  it('SPEC-CON-09, PRD-M-10: existing Contract -> new unlocked version with new AI items plus manual items; old version untouched', async () => {
    await seed({ height: 500 });
    const manual = requirement({ id: 'R-01', origin: 'user', statement: 'Mine', accepted: true });
    const aiOld = requirement({ id: 'R-02', origin: 'ai' });
    const inferred = requirement({ id: 'I-M-01', label: 'inferred', origin: 'rule', viewport: 'mobile' });
    const old = contract({
      id: 'old',
      projectId: PID,
      version: 1,
      locked: true,
      requirements: [manual, aiOld, inferred],
    });
    await store.putContract(old);
    await patchProject({ activeContractId: 'old' });
    const c = done(await extract());
    expect(c.version).toBe(2);
    expect(c.id).not.toBe('old');
    expect(c.locked).toBe(false);
    expect(c.requirements.find((r) => r.statement === 'Mine')).toMatchObject({ origin: 'user', accepted: true });
    expect(c.requirements.filter((r) => r.origin === 'ai')).toHaveLength(3);
    expect(c.requirements.some((r) => r.origin === 'rule')).toBe(false);
    expect(new Set(c.requirements.map((r) => r.id)).size).toBe(c.requirements.length);
    expect((await store.get(PID))?.activeContractId).toBe(c.id);
    expect(await store.getContract('old')).toEqual(old);
  });

  it('SPEC-CON-09: AI items from the old version are replaced, not duplicated, on re-extract', async () => {
    await seed({ height: 500 });
    const first = done(await extract());
    const second = done(await extract());
    expect(second.version).toBe(first.version + 1);
    expect(second.requirements.filter((r) => r.origin === 'ai')).toHaveLength(3);
  });

  it('SPEC-CON-09, SPEC-DEMO-03: on a sample Project the result is pendingAiContractId and active is unchanged', async () => {
    await seed({ height: 500, isSample: true });
    const committed = contract({
      id: 'committed',
      projectId: PID,
      locked: false,
      requirements: [requirement({ origin: 'sample' })],
    });
    await store.putContract(committed);
    await patchProject({ activeContractId: 'committed' });
    const c = done(await extract());
    const p = await store.get(PID);
    expect(p?.pendingAiContractId).toBe(c.id);
    expect(p?.activeContractId).toBe('committed');
    expect(await store.getContract(c.id)).toEqual(c);
    expect(await svc.active(PID)).toEqual(committed);
  });

  it('SPEC-CON-09: a sample Project without a Contract still keeps the result pending', async () => {
    await seed({ height: 500, isSample: true });
    const c = done(await extract());
    const p = await store.get(PID);
    expect(p?.pendingAiContractId).toBe(c.id);
    expect(p?.activeContractId).toBeUndefined();
  });
});
