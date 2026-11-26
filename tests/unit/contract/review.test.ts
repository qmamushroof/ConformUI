import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type AiTask,
  type Contract,
  CuiError,
  DEFAULT_RUNTIME_VALUES,
  type EngineStatus,
  type ErrorCode,
  type ImageCodec,
  MAX_REQUIREMENTS,
  type ManualRequirementDraft,
  type MeasureClient,
  mintConsent,
  type Requirement,
  type RuntimeConfig,
  VIEWPORT_PRESETS,
  type ViewportId,
} from '@kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeAiEngine, type FakeAiConfig, type FakeAiEngine } from '../../../src/app/testing/fake-ai-engine';
import { type ContractService, createContractService, type ExtractOutcome } from '../../../src/features/contract';
import { fixedClock, sequentialIds } from '../../helpers/clock-ids';
import { InMemoryBlobStore, InMemoryProjectStore } from '../../helpers/memory-stores';
import { contract, designRef, imageRef, project, requirement, run, settings } from '../../helpers/samples';

const valid = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/ai/extract-contract-valid.json'), 'utf8'));
const PID = 'project-1';

let store: InMemoryProjectStore;
let blobs: InMemoryBlobStore;
let fakeCfg: FakeAiConfig;
let ai: FakeAiEngine;
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
  async crop(blob, _r, maxSide, mime) {
    return { mime, base64: 'QUJD', bytes: 1000 + maxSide, role: 'design', blob };
  },
  async composePair() {
    throw new Error('unused');
  },
});
const measure = { snapRegion: async (_i: unknown, r: object) => ({ rect: r, iou: 1 }) } as unknown as MeasureClient;
const config: RuntimeConfig = { get: () => DEFAULT_RUNTIME_VALUES, refresh: async () => undefined };

const status = (s: Partial<EngineStatus> = {}): EngineStatus => ({
  device: 'available',
  deviceImage: true,
  online: true,
  cloud: 'enabled',
  ...s,
});

async function seed(viewports: ViewportId[] = ['desktop'], isSample = false) {
  const designs = [];
  for (const v of viewports) {
    const blobId = await blobs.put(new Blob(['x'], { type: 'image/png' }));
    const w = VIEWPORT_PRESETS[v];
    designs.push(
      designRef({ id: `d-${v}`, viewport: v, image: imageRef({ blobId, width: w, cssWidth: w, height: 400 }) }),
    );
  }
  await store.put(project({ id: PID, designs, captures: [], isSample }));
}

const extract = (st: Partial<EngineStatus> = {}, withConsent = false) =>
  svc.extract(
    PID,
    {
      settings: settings({ mode: 'auto' }),
      status: status(st),
      ...(withConsent && { projectConsent: mintConsent({ scope: 'project', projectId: PID }, { isTrusted: true }) }),
    },
    () => undefined,
  );
const done = (o: ExtractOutcome): Contract => {
  if (o.kind !== 'done') throw new Error(`expected done, got ${o.kind}`);
  return o.contract;
};
const calls = (task: AiTask) => ai.calls.filter((c) => c.task === task);
const inferred = (c: Contract) => c.requirements.filter((r) => r.label === 'inferred');
const ids = (c: Contract) => c.requirements.map((r) => r.id);

/** Stores a Contract as the Project's active one (as the Run service leaves it after a Run when locked). */
async function activate(over: Partial<Contract> = {}): Promise<Contract> {
  const c = contract({ id: 'c-1', projectId: PID, ...over });
  await store.putContract(c);
  const p = await store.get(PID);
  await store.put({ ...(p as NonNullable<typeof p>), activeContractId: c.id });
  return c;
}
const activeId = async () => (await store.get(PID))?.activeContractId;
const R = (n: number, over: Partial<Requirement> = {}) =>
  requirement({ id: `R-0${n}`, primary: false, accepted: false, ...over });

const draft = (over: Partial<ManualRequirementDraft> = {}): ManualRequirementDraft => ({
  viewport: 'desktop',
  category: 'presence',
  statement: 'Footer is present',
  condition: 'A footer element is visible',
  checkType: 'measured',
  check: { kind: 'presence', match: { tag: 'footer' } },
  ...over,
});

beforeEach(() => {
  store = new InMemoryProjectStore();
  blobs = new InMemoryBlobStore();
  fakeCfg = { status: 'available+image', outputs: { 'extract-contract': valid } };
  ai = createFakeAiEngine(fakeCfg, {});
  svc = createContractService({
    ai,
    config,
    store,
    blobs,
    codec: codec(),
    clock: fixedClock(),
    ids: sequentialIds('new'),
    measure,
  });
});

describe('SPEC-CON-04, S24, PRD-M-10, PRD-F-08.3: Inferred generation after extraction', () => {
  it('SPEC-CON-04, PRD-M-10: desktop-only design -> Mobile I-M-01 layout-fits plus one visible per primary item, all Inferred', async () => {
    await seed(['desktop']);
    const c = done(await extract());
    const inf = inferred(c);
    expect(inf.map((r) => r.id)).toEqual(['I-M-01', 'I-M-02']);
    expect(inf[0]).toMatchObject({
      viewport: 'mobile',
      label: 'inferred',
      origin: 'rule',
      checkType: 'measured',
      check: { kind: 'layout-fits' },
      accepted: false,
    });
    expect(inf[0]?.statement).toMatch(/^Expected on Mobile \(inferred\):/);
    const primary = c.requirements.find((r) => r.primary);
    expect(inf[1]).toMatchObject({
      viewport: 'mobile',
      label: 'inferred',
      origin: 'rule',
      derivedFrom: primary?.id,
      check: { kind: 'visible', match: { tag: 'button', text: 'Start free' } },
    });
    expect(inf[1]?.statement).toMatch(/^Expected on Mobile \(inferred\):/);
    expect(inf[1]?.statement).toMatch(/primary action stays visible/i);
    expect(c.requirements.filter((r) => r.label === 'explicit')).toHaveLength(3); // other explicit items not copied (S8)
    expect(await svc.active(PID)).toEqual(c);
  });

  it('SPEC-CON-04: mobile-only design -> Desktop ids I-D-01, I-D-02', async () => {
    await seed(['mobile']);
    const inf = inferred(done(await extract()));
    expect(inf.map((r) => r.id)).toEqual(['I-D-01', 'I-D-02']);
    expect(inf.every((r) => r.viewport === 'desktop')).toBe(true);
    expect(inf[0]?.statement).toMatch(/^Expected on Desktop \(inferred\):/);
  });

  it('SPEC-CON-04: both P0 viewports have designs -> no Inferred items', async () => {
    await seed(['desktop', 'mobile']);
    expect(inferred(done(await extract()))).toHaveLength(0);
  });

  it('SPEC-CON-04: no primary item -> only the layout-fits item', async () => {
    await seed(['desktop']);
    const noPrimary = {
      requirements: valid.requirements.map((r: Record<string, unknown>) => ({ ...r, primary: undefined })),
    };
    fakeCfg.outputs = { 'extract-contract': noPrimary };
    expect(inferred(done(await extract())).map((r) => r.id)).toEqual(['I-M-01']);
  });

  it('SPEC-CON-04: several primaries -> I-M-02.. in document order, derivedFrom each', async () => {
    await seed(['desktop']);
    const two = {
      requirements: [
        { ...valid.requirements[0], box: [100, 100, 300, 160] },
        {
          ...valid.requirements[0],
          statement: 'Second CTA exists',
          box: [500, 700, 700, 760],
          matchHint: { tag: 'a' },
        },
      ],
    };
    fakeCfg.outputs = { 'extract-contract': two };
    const c = done(await extract());
    const inf = inferred(c);
    expect(inf.map((r) => r.id)).toEqual(['I-M-01', 'I-M-02', 'I-M-03']);
    expect(inf[1]?.derivedFrom).toBe('R-01');
    expect(inf[2]?.derivedFrom).toBe('R-02');
    expect(new Set(ids(c)).size).toBe(ids(c).length);
  });

  it('SPEC-CON-04: the nearest design reference supplies the primaries (Mobile missing, Desktop and Tablet exist -> Tablet)', async () => {
    await seed(['desktop', 'tablet']);
    const c = done(await extract());
    const visible = inferred(c).find((r) => r.check.kind === 'visible');
    const from = c.requirements.find((r) => r.id === visible?.derivedFrom);
    expect(from?.viewport).toBe('tablet');
    expect(inferred(c).every((r) => r.viewport === 'mobile')).toBe(true);
  });

  it('S24: extraction never calls infer-responsive while feature_ai_infer_responsive is false', async () => {
    await seed(['desktop']);
    await extract();
    expect(calls('infer-responsive')).toHaveLength(0);
  });

  it('S24: re-extract regenerates the same Inferred ids (stable) and does not duplicate them', async () => {
    await seed(['desktop']);
    const first = done(await extract());
    const second = done(await extract());
    expect(inferred(second).map((r) => r.id)).toEqual(inferred(first).map((r) => r.id));
    expect(new Set(ids(second)).size).toBe(ids(second).length);
  });

  it('SPEC-CON-04: manual items survive re-extract and Inferred items still appear once', async () => {
    await seed(['desktop']);
    await activate({ requirements: [R(1, { origin: 'user', accepted: true, statement: 'Mine' })] });
    const c = done(await extract());
    expect(c.requirements.filter((r) => r.statement === 'Mine')).toHaveLength(1);
    expect(inferred(c).map((r) => r.id)).toEqual(['I-M-01', 'I-M-02']);
    expect(new Set(ids(c)).size).toBe(ids(c).length);
  });

  it('SPEC-CON-04: a Contract full of manual items still gets unique ids', async () => {
    await seed(['desktop']);
    const manual = Array.from({ length: MAX_REQUIREMENTS - 1 }, (_, i) =>
      requirement({ id: `R-${String(i + 50).padStart(2, '0')}`, origin: 'user', primary: false }),
    );
    await activate({ requirements: manual });
    const c = done(await extract());
    expect(new Set(ids(c)).size).toBe(ids(c).length);
  });
});

describe('SPEC-CON-03: Inferred items on blocked outcomes and the no-AI path', () => {
  it('SPEC-CON-03: offline -> blocked, rule-based Inferred items only, saved and active, zero ai.run calls', async () => {
    await seed(['desktop']);
    const out = await extract({ online: false, deviceImage: false }, true);
    expect(out.kind).toBe('blocked');
    if (out.kind !== 'blocked') return;
    expect(out.contract.requirements.map((r) => r.id)).toEqual(['I-M-01']); // no primary without extraction
    expect(out.contract.requirements.every((r) => r.origin === 'rule' && r.label === 'inferred')).toBe(true);
    expect(ai.calls).toHaveLength(0);
    expect(await svc.active(PID)).toEqual(out.contract);
  });

  const codes: ErrorCode[] = ['OFFLINE', 'CLOUD_DISABLED', 'DEVICE_UNAVAILABLE', 'QUOTA_EXCEEDED', 'AI_FAILED'];
  for (const code of codes) {
    it(`SPEC-CON-03: ${code} from the engine -> blocked with rule-based items, no AI items saved`, async () => {
      await seed(['desktop']);
      fakeCfg.errors = { 'extract-contract': code };
      const out = await extract();
      expect(out.kind).toBe('blocked');
      if (out.kind !== 'blocked') return;
      expect(out.contract.requirements.filter((r) => r.origin === 'ai')).toHaveLength(0);
      expect(inferred(out.contract).length).toBeGreaterThan(0);
      expect((await svc.active(PID))?.requirements.some((r) => r.origin === 'ai')).toBe(false);
    });
  }

  it('SPEC-CON-03: blocked with both viewports designed -> nothing to infer, nothing saved', async () => {
    await seed(['desktop', 'mobile']);
    const out = await extract({ online: false, deviceImage: false }, true);
    expect(out.kind).toBe('blocked');
    if (out.kind === 'blocked') expect(out.contract.requirements).toHaveLength(0);
    expect(await svc.active(PID)).toBeUndefined();
  });

  it('SPEC-CON-03, SPEC-CON-06: blocked with a locked Contract lacking Inferred items -> new unlocked version, old one untouched', async () => {
    await seed(['desktop']);
    const old = await activate({ locked: true, requirements: [R(1, { origin: 'user', accepted: true })] });
    const out = await extract({ online: false, deviceImage: false }, true);
    if (out.kind !== 'blocked') throw new Error('expected blocked');
    expect(out.contract.version).toBe(2);
    expect(out.contract.locked).toBe(false);
    expect(out.contract.requirements.some((r) => r.id === 'R-01')).toBe(true);
    expect(await store.getContract(old.id)).toEqual(old);
    expect(await activeId()).toBe(out.contract.id);
  });

  it('SPEC-CON-04, S24: blocked with a Contract that already has Inferred items -> same Contract, no new version', async () => {
    await seed(['desktop']);
    const old = await activate({
      locked: true,
      requirements: [requirement({ id: 'I-M-01', viewport: 'mobile', label: 'inferred', origin: 'rule' })],
    });
    const out = await extract({ online: false, deviceImage: false }, true);
    if (out.kind !== 'blocked') throw new Error('expected blocked');
    expect(out.contract).toEqual(old);
    expect(await activeId()).toBe(old.id);
  });

  it('PRD-M-06, SPEC-CON-03: needs-consent saves nothing and makes zero calls', async () => {
    await seed(['desktop']);
    const out = await extract({ deviceImage: false });
    expect(out.kind).toBe('needs-consent');
    expect(ai.calls).toHaveLength(0);
    expect(await svc.active(PID)).toBeUndefined();
  });

  it('SPEC-CON-03, SPEC-CON-04: after a declined consent the user adds a Requirement and Inferred items appear', async () => {
    await seed(['desktop']);
    await activate({ requirements: [] });
    const c = await svc.add('c-1', draft());
    expect(inferred(c).map((r) => r.id)).toEqual(['I-M-01']);
    expect(c.requirements.find((r) => r.id === 'R-01')).toMatchObject({ origin: 'user', accepted: true });
  });
});

describe('SPEC-CON-04, S24: no regeneration when Inferred items exist', () => {
  it('SPEC-CON-04: accept on a Contract that has Inferred items for the missing viewport does not add more', async () => {
    await seed(['desktop']);
    await activate({
      requirements: [
        R(1, { primary: true }),
        requirement({ id: 'I-M-01', viewport: 'mobile', label: 'inferred', origin: 'rule', accepted: false }),
      ],
    });
    const c = await svc.accept('c-1', 'all');
    expect(ids(c)).toEqual(['R-01', 'I-M-01']);
  });

  it('SPEC-CON-04: accept generates Inferred items once when a P0 viewport has no design, then not again', async () => {
    await seed(['desktop']);
    await activate({ requirements: [R(1, { primary: true })] });
    const a = await svc.accept('c-1', ['R-01']);
    expect(ids(a)).toEqual(['R-01', 'I-M-01', 'I-M-02']);
    expect(a.requirements.find((r) => r.id === 'I-M-02')?.derivedFrom).toBe('R-01');
    const b = await svc.accept('c-1', ['R-01']);
    expect(ids(b)).toEqual(['R-01', 'I-M-01', 'I-M-02']);
  });

  it('SPEC-CON-04: removing the last Inferred item of a viewport lets the next add regenerate it (documented)', async () => {
    await seed(['desktop']);
    await activate({ requirements: [R(1)] });
    await svc.accept('c-1', 'all');
    await svc.remove('c-1', 'I-M-01');
    const c = await svc.add('c-1', draft());
    expect(c.requirements.some((r) => r.id === 'I-M-01')).toBe(true);
  });

  it('SPEC-CON-04: Inferred items of one viewport do not stop generation for another missing viewport', async () => {
    await seed(['tablet']);
    await activate({
      requirements: [R(1), requirement({ id: 'I-D-01', viewport: 'desktop', label: 'inferred', origin: 'rule' })],
    });
    const c = await svc.accept('c-1', 'all');
    expect(ids(c)).toEqual(['R-01', 'I-D-01', 'I-M-01']);
  });
});

describe('SPEC-CON-05: review (accept, edit, remove, add)', () => {
  beforeEach(async () => {
    await seed(['desktop', 'mobile']);
    await activate({ requirements: [R(1), R(2), R(3)] });
  });

  it('SPEC-CON-05: accept one, several, then all; others untouched; persisted', async () => {
    let c = await svc.accept('c-1', ['R-02']);
    expect(c.requirements.map((r) => r.accepted)).toEqual([false, true, false]);
    c = await svc.accept('c-1', ['R-01', 'R-02']);
    expect(c.requirements.map((r) => r.accepted)).toEqual([true, true, false]);
    c = await svc.accept('c-1', 'all');
    expect(c.requirements.every((r) => r.accepted)).toBe(true);
    expect(await store.getContract('c-1')).toEqual(c);
    expect(c.id).toBe('c-1');
  });

  it('SPEC-CON-05: accepting an unknown id rejects and changes nothing', async () => {
    const before = await store.getContract('c-1');
    await expect(svc.accept('c-1', ['R-02', 'R-99'])).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    expect(await store.getContract('c-1')).toEqual(before);
  });

  it('SPEC-CON-05: accept [] is a no-op', async () => {
    const before = await store.getContract('c-1');
    expect(await svc.accept('c-1', [])).toEqual(before);
  });

  it('SPEC-CON-05: an unknown Contract id -> STORAGE_FAILED', async () => {
    await expect(svc.accept('nope', 'all')).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });

  it('SPEC-CON-05: editText changes statement and/or condition only, never check, accepted or origin', async () => {
    await svc.accept('c-1', ['R-01']);
    const before = (await store.getContract('c-1'))?.requirements[0] as Requirement;
    let c = await svc.editText('c-1', 'R-01', { statement: 'New statement' });
    let r = c.requirements[0] as Requirement;
    expect(r).toMatchObject({ statement: 'New statement', condition: before.condition, accepted: true, origin: 'ai' });
    expect(r.check).toEqual(before.check);
    c = await svc.editText('c-1', 'R-01', { condition: 'New condition' });
    r = c.requirements[0] as Requirement;
    expect(r).toMatchObject({ statement: 'New statement', condition: 'New condition' });
    c = await svc.editText('c-1', 'R-01', { statement: 'Both', condition: 'Both too' });
    expect(c.requirements[0]).toMatchObject({ statement: 'Both', condition: 'Both too' });
  });

  it('SPEC-CON-05: editText trims, caps at 160 / 200 characters and rejects empty text', async () => {
    const c = await svc.editText('c-1', 'R-01', { statement: `  ${'a'.repeat(300)}  `, condition: 'b'.repeat(300) });
    expect(c.requirements[0]?.statement).toBe('a'.repeat(160));
    expect(c.requirements[0]?.condition).toBe('b'.repeat(200));
    await expect(svc.editText('c-1', 'R-01', { statement: '   ' })).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    await expect(svc.editText('c-1', 'R-99', { statement: 'x' })).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });

  it('SPEC-CON-05: remove deletes one item, keeps the others and their order', async () => {
    const c = await svc.remove('c-1', 'R-02');
    expect(ids(c)).toEqual(['R-01', 'R-03']);
    await expect(svc.remove('c-1', 'R-02')).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });

  it('SPEC-CON-05, SPEC-CON-08: add creates an accepted manual item with the next id after the highest R number', async () => {
    const c = await svc.add('c-1', draft());
    const added = c.requirements.at(-1) as Requirement;
    expect(added).toMatchObject({
      id: 'R-04',
      origin: 'user',
      label: 'explicit',
      accepted: true,
      viewport: 'desktop',
      statement: 'Footer is present',
      check: { kind: 'presence', match: { tag: 'footer' } },
    });
    expect(added.engine).toBeUndefined();
    await svc.remove('c-1', 'R-04'); // the highest id is removed: it is reused only because nothing else holds it
    expect((await svc.add('c-1', draft({ statement: 'Another' }))).requirements.at(-1)?.id).toBe('R-04');
  });

  it('SPEC-CON-05: ids of removed items in the middle are not reused', async () => {
    await svc.remove('c-1', 'R-02');
    expect((await svc.add('c-1', draft())).requirements.at(-1)?.id).toBe('R-04');
  });

  it('SPEC-CON-05: add rejects an invalid draft (empty statement, overlong text) and a full Contract', async () => {
    await expect(svc.add('c-1', draft({ statement: '' }))).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    await expect(svc.add('c-1', draft({ statement: 'x'.repeat(161) }))).rejects.toMatchObject({
      code: 'STORAGE_FAILED',
    });
    const full = Array.from({ length: MAX_REQUIREMENTS }, (_, i) => R(1, { id: `R-${i + 100}` }));
    await store.putContract(contract({ id: 'full', projectId: PID, requirements: full }));
    await expect(svc.add('full', draft())).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });

  it('SPEC-CON-07 [P1]: setRegion stores a user region and leaves the rest', async () => {
    const c = await svc.setRegion('c-1', 'R-01', { x: 1, y: 2, w: 30, h: 40 });
    expect(c.requirements[0]?.region).toEqual({ rect: { x: 1, y: 2, w: 30, h: 40 }, source: 'user' });
    expect(c.requirements[1]?.region).toEqual(requirement().region);
    await expect(svc.setRegion('c-1', 'R-99', { x: 0, y: 0, w: 1, h: 1 })).rejects.toMatchObject({
      code: 'STORAGE_FAILED',
    });
  });
});

describe('SPEC-CON-06: lock and versioning', () => {
  beforeEach(async () => {
    await seed(['desktop', 'mobile']);
  });

  it('SPEC-CON-06: an edit on the active locked Contract creates version 2, unlocked, same ids, and it becomes active', async () => {
    const v1 = await activate({ locked: true, requirements: [R(1), R(2)] });
    const v2 = await svc.accept('c-1', ['R-01']);
    expect(v2).toMatchObject({ version: 2, locked: false, projectId: PID });
    expect(v2.id).not.toBe(v1.id);
    expect(ids(v2)).toEqual(['R-01', 'R-02']);
    expect(v2.requirements[0]?.accepted).toBe(true);
    expect(await activeId()).toBe(v2.id);
    expect(await store.getContract(v2.id)).toEqual(v2);
    expect(await store.getContract('c-1')).toEqual(v1); // locked original is immutable
    expect((await store.getContract('c-1'))?.locked).toBe(true);
  });

  const ops: [string, (s: ContractService) => Promise<Contract>][] = [
    ['accept', (s) => s.accept('c-1', 'all')],
    ['editText', (s) => s.editText('c-1', 'R-01', { statement: 'Changed' })],
    ['remove', (s) => s.remove('c-1', 'R-01')],
    ['add', (s) => s.add('c-1', draft())],
    ['setRegion', (s) => s.setRegion('c-1', 'R-01', { x: 0, y: 0, w: 5, h: 5 })],
  ];
  for (const [name, op] of ops) {
    it(`SPEC-CON-06: ${name} on a locked Contract that is no longer active -> CONTRACT_LOCKED, nothing saved`, async () => {
      const old = await activate({ locked: true, requirements: [R(1), R(2)] });
      const newer = contract({ id: 'c-2', projectId: PID, version: 2, requirements: [R(1)] });
      await store.putContract(newer);
      const p = await store.get(PID);
      await store.put({ ...(p as NonNullable<typeof p>), activeContractId: 'c-2' });
      const err = await op(svc).catch((e) => e);
      expect(err).toBeInstanceOf(CuiError);
      expect(err.code).toBe('CONTRACT_LOCKED');
      expect(await store.getContract('c-1')).toEqual(old);
      expect(await store.getContract('c-2')).toEqual(newer);
      expect(await activeId()).toBe('c-2');
    });

    it(`SPEC-CON-06: ${name} on the active locked Contract versions it`, async () => {
      await activate({ locked: true, requirements: [R(1), R(2)] });
      const v2 = await op(svc);
      expect(v2.version).toBe(2);
      expect(v2.locked).toBe(false);
      expect((await store.getContract('c-1'))?.locked).toBe(true);
    });
  }

  it('SPEC-CON-06: further edits on the unlocked version 2 change it in place (no version 3)', async () => {
    await activate({ locked: true, requirements: [R(1), R(2)] });
    const v2 = await svc.accept('c-1', ['R-01']);
    const again = await svc.editText(v2.id, 'R-02', { statement: 'Again' });
    expect(again.id).toBe(v2.id);
    expect(again.version).toBe(2);
    expect(await activeId()).toBe(v2.id);
  });

  it('SPEC-CON-06, PRD-F-03.5: edit after a Run creates version 2 while the Run still references version 1', async () => {
    await activate({ locked: true, requirements: [R(1)] });
    await store.putRun(run({ id: 'run-1', projectId: PID, contractId: 'c-1' }));
    const v2 = await svc.editText('c-1', 'R-01', { statement: 'After the run' });
    expect(v2.version).toBe(2);
    expect((await store.getRun('run-1'))?.contractId).toBe('c-1');
    expect((await store.getContract('c-1'))?.requirements[0]?.statement).not.toBe('After the run');
  });

  it('SPEC-CON-06: user edits are preserved across versions (text, accepted, manual items)', async () => {
    await activate({ requirements: [R(1), R(2)] });
    await svc.editText('c-1', 'R-01', { statement: 'Edited' });
    await svc.accept('c-1', ['R-02']);
    await svc.add('c-1', draft());
    const locked: Contract = { ...((await store.getContract('c-1')) as Contract), locked: true };
    await store.putContract(locked);
    const v2 = await svc.remove('c-1', 'R-02');
    expect(v2.requirements.map((r) => [r.id, r.statement])).toEqual([
      ['R-01', 'Edited'],
      ['R-03', 'Footer is present'],
    ]);
    expect(v2.requirements[1]?.origin).toBe('user');
    await store.putContract({ ...v2, locked: true });
    const v3 = await svc.accept(v2.id, 'all');
    expect(v3.version).toBe(3);
    expect(v3.requirements[0]?.statement).toBe('Edited');
  });

  it('SPEC-CON-06: an unknown Contract id -> STORAGE_FAILED, not CONTRACT_LOCKED', async () => {
    await expect(svc.remove('missing', 'R-01')).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });
});

describe('SPEC-CON-09, SPEC-DEMO-03, SPEC-DEMO-05: sample contracts', () => {
  beforeEach(async () => {
    await seed(['desktop'], true);
  });

  it('SPEC-DEMO-03: loadCommitted stores the committed Contract for the Project and makes it active', async () => {
    const committed = contract({
      id: 'committed',
      projectId: 'elsewhere',
      locked: true,
      requirements: [
        R(1, { origin: 'sample', accepted: true }),
        requirement({ id: 'I-M-01', viewport: 'mobile', label: 'inferred', origin: 'sample', accepted: true }),
      ],
    });
    const c = await svc.loadCommitted(PID, committed);
    expect(c.projectId).toBe(PID);
    expect(ids(c)).toEqual(['R-01', 'I-M-01']); // Inferred exist: not regenerated (S24)
    expect(c.locked).toBe(true);
    expect(await activeId()).toBe(c.id);
    expect(await svc.active(PID)).toEqual(c);
    expect(ai.calls).toHaveLength(0);
  });

  it('SPEC-DEMO-03: loadCommitted on an unknown Project -> STORAGE_FAILED', async () => {
    await expect(svc.loadCommitted('nope', contract())).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });

  it('SPEC-DEMO-03: useAiContract moves pendingAiContractId to active and clears it; the verified one stays stored', async () => {
    await activate({ id: 'verified', requirements: [R(1, { origin: 'sample' })] });
    const pending = done(await extract());
    expect((await store.get(PID))?.pendingAiContractId).toBe(pending.id);
    const used = await svc.useAiContract(PID);
    expect(used.id).toBe(pending.id);
    const p = await store.get(PID);
    expect(p?.activeContractId).toBe(pending.id);
    expect(p?.pendingAiContractId).toBeUndefined();
    expect(await store.getContract('verified')).toBeDefined();
  });

  it('SPEC-DEMO-03: useAiContract without a pending Contract, or with a missing one -> STORAGE_FAILED', async () => {
    await expect(svc.useAiContract(PID)).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    const p = await store.get(PID);
    await store.put({ ...(p as NonNullable<typeof p>), pendingAiContractId: 'gone' });
    await expect(svc.useAiContract(PID)).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });

  it('SPEC-DEMO-05, S29: loadPrecomputedExtraction stores origin precomputed, unaccepted, as pendingAiContractId; active unchanged; zero calls', async () => {
    await activate({ id: 'verified', requirements: [R(1, { origin: 'sample' })] });
    const c = await svc.loadPrecomputedExtraction(PID, [R(1, { origin: 'sample', accepted: true }), R(2)]);
    const explicit = c.requirements.filter((r) => r.label === 'explicit');
    expect(explicit.map((r) => r.id)).toEqual(['R-01', 'R-02']);
    expect(explicit.every((r) => r.origin === 'precomputed' && r.accepted === false)).toBe(true);
    expect(c.version).toBe(2);
    const p = await store.get(PID);
    expect(p?.pendingAiContractId).toBe(c.id);
    expect(p?.activeContractId).toBe('verified');
    expect(await store.getContract(c.id)).toEqual(c);
    expect(ai.calls).toHaveLength(0);
  });

  it('SPEC-DEMO-05: loadPrecomputedExtraction on a Project without a Contract is version 1; unknown Project -> STORAGE_FAILED', async () => {
    expect((await svc.loadPrecomputedExtraction(PID, [R(1)])).version).toBe(1);
    await expect(svc.loadPrecomputedExtraction('nope', [R(1)])).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });
});
