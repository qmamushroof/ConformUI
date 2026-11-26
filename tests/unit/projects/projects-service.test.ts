import { CuiError, type ImageCodec, MAX_PROJECTS, mintConsent } from '@kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectsService, type ProjectsService, staleViewports } from '../../../src/features/projects';
import { fixedClock, sequentialIds } from '../../helpers/clock-ids';
import { InMemoryBlobStore, InMemoryProjectStore } from '../../helpers/memory-stores';
import { domSnapshot, requirementResult, run } from '../../helpers/samples';

// A file is `img(width)`: a blob whose text carries its source width. The fake codec scales to the CSS width asked for.
const img = (width: number, mime = 'image/png') =>
  new Blob([JSON.stringify({ w: width, h: width * 2 })], { type: mime });

const codec: ImageCodec = {
  async probe(file) {
    const { w, h } = JSON.parse(await file.text());
    return { width: w, height: h, mime: file.type };
  },
  async normalise(file, cssWidth) {
    if (file.type === 'application/pdf') throw new CuiError('IMAGE_UNSUPPORTED', 'Use PNG, JPEG or WebP');
    if (file.size > 100) throw new CuiError('IMAGE_TOO_LARGE', 'Larger than 20 MB');
    const { w, h } = JSON.parse(await file.text());
    const height = Math.round((h * cssWidth) / w);
    const blob = new Blob([JSON.stringify({ w: cssWidth, h: height })], { type: 'image/png' });
    return { blob, ref: { mime: 'image/png', width: cssWidth, height, cssWidth, bytes: blob.size } };
  },
  async pixels() {
    throw new Error('unused');
  },
  async crop() {
    throw new Error('unused');
  },
  async composePair() {
    throw new Error('unused');
  },
};

let store: InMemoryProjectStore;
let blobs: InMemoryBlobStore;
let clock: ReturnType<typeof fixedClock>;
let svc: ProjectsService;

beforeEach(() => {
  store = new InMemoryProjectStore();
  blobs = new InMemoryBlobStore();
  clock = fixedClock();
  svc = createProjectsService({ store, blobs, codec, clock, ids: sequentialIds('x') });
});

describe('create, list, get, remove, rename', () => {
  it('SPEC-PROJ-06, PRD-F-01.2: create gives a default name "Untitled page n" and an empty project', async () => {
    const a = await svc.create('');
    const b = await svc.create('   ');
    expect(a.name).toBe('Untitled page 1');
    expect(b.name).toBe('Untitled page 2');
    expect(a).toMatchObject({ designs: [], captures: [], isSample: false, cloudUsage: { requests: 0, bytes: 0 } });
    expect(await svc.get(a.id)).toEqual(a);
  });

  it('SPEC-PROJ-06: names are trimmed and cut to 80 characters', async () => {
    const p = await svc.create(`  ${'a'.repeat(100)}  `);
    expect(p.name).toBe('a'.repeat(80));
  });

  it('SPEC-PROJ-06: default numbering skips names already taken', async () => {
    await svc.create('');
    await svc.create('');
    expect((await svc.create('')).name).toBe('Untitled page 3');
    await svc.create('Untitled page 4');
    expect((await svc.create('')).name).toBe('Untitled page 5');
  });

  it('SPEC-PROJ-06, PRD-F-01.2: list is sorted by updatedAt descending and never auto-deletes past MAX_PROJECTS', async () => {
    const a = await svc.create('A');
    clock.advance(10);
    const b = await svc.create('B');
    clock.advance(10);
    await svc.addDesign(a.id, img(1440), 'desktop');
    const listed = await svc.list();
    expect(listed.map((s) => s.id)).toEqual([a.id, b.id]);
    expect(listed[0]).toMatchObject({ viewports: ['desktop'], isSample: false });
    for (let i = 0; i < MAX_PROJECTS + 2; i++) await svc.create(`P${i}`);
    expect((await svc.list()).length).toBe(MAX_PROJECTS + 4);
  });

  it('SPEC-PROJ-06: list summarises the latest run as pass/fail/review counts', async () => {
    const p = await svc.create('A');
    const mk = (id: string, createdAt: number, statuses: ('pass' | 'fail' | 'needs-review' | 'not-checked')[]) =>
      run({
        id,
        projectId: p.id,
        createdAt,
        results: statuses.map((status, i) => requirementResult({ requirementId: `R-0${i}`, status })),
      });
    await store.putRun(mk('old', 100, ['fail']));
    await store.putRun(mk('new', 200, ['pass', 'pass', 'fail', 'needs-review', 'not-checked']));
    expect((await svc.list())[0]?.lastRun).toEqual({ at: 200, pass: 2, fail: 1, review: 1 });
  });

  it('SPEC-PROJ-06: a project without runs has no lastRun; get of an unknown id is undefined', async () => {
    await svc.create('A');
    expect((await svc.list())[0]?.lastRun).toBeUndefined();
    expect(await svc.get('nope')).toBeUndefined();
  });

  it('PRD-F-01.1: remove deletes the project, its records and every blob; an unknown id is a no-op', async () => {
    const p = await svc.create('A');
    await svc.addDesign(p.id, img(1440), 'desktop');
    await svc.addCapture(p.id, img(1440), 'desktop');
    await store.putRun(run({ projectId: p.id }));
    expect(blobs.size).toBe(2);
    await svc.remove(p.id);
    expect(await svc.get(p.id)).toBeUndefined();
    expect(await store.listRuns(p.id)).toEqual([]);
    expect(blobs.size).toBe(0);
    await expect(svc.remove('nope')).resolves.toBeUndefined();
  });

  it('PRD-F-01.3, SPEC-PROJ-06: rename trims, cuts to 80, ignores blank, bumps updatedAt', async () => {
    const p = await svc.create('A');
    clock.advance(5);
    await svc.rename(p.id, ` ${'b'.repeat(90)} `);
    const r = await svc.get(p.id);
    expect(r?.name).toBe('b'.repeat(80));
    expect(r?.updatedAt).toBe(p.updatedAt + 5);
    await svc.rename(p.id, '   ');
    expect((await svc.get(p.id))?.name).toBe('b'.repeat(80));
  });

  it('SPEC-PROJ-06: operations on an unknown project fail with STORAGE_FAILED and store nothing', async () => {
    const t = mintConsent({ scope: 'project', projectId: 'nope' }, { isTrusted: true });
    await expect(svc.rename('nope', 'x')).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    await expect(svc.addDesign('nope', img(1440), 'desktop')).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    await expect(svc.addCapture('nope', img(1440), 'desktop')).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    await expect(svc.grantCloudConsent('nope', t)).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    await expect(svc.recordCloudUsage('nope', 1)).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    expect(blobs.size).toBe(0);
  });
});

describe('addDesign, addCapture, attachSnapshot', () => {
  it('SPEC-PROJ-02, SPEC-PROJ-03: addDesign normalises to the preset width, stores the blob and the ref', async () => {
    const p = await svc.create('A');
    const d = await svc.addDesign(p.id, img(2880), 'desktop');
    expect(d).toMatchObject({
      viewport: 'desktop',
      addedAt: clock.now(),
      image: { cssWidth: 1440, mime: 'image/png' },
    });
    expect(await blobs.get(d.image.blobId)).toBeDefined();
    expect((await svc.get(p.id))?.designs).toEqual([d]);
  });

  it('SPEC-PROJ-03: a second design for a viewport replaces the first and deletes its blob', async () => {
    const p = await svc.create('A');
    const d1 = await svc.addDesign(p.id, img(1440), 'desktop');
    const m = await svc.addDesign(p.id, img(390), 'mobile');
    const d2 = await svc.addDesign(p.id, img(1440), 'desktop');
    const got = await svc.get(p.id);
    expect(got?.designs.map((d) => d.id).sort()).toEqual([d2.id, m.id].sort());
    expect(await blobs.get(d1.image.blobId)).toBeUndefined();
    expect(blobs.size).toBe(2);
  });

  it('SPEC-PROJ-02: unsupported and oversized files reject with the codec error and store nothing', async () => {
    const p = await svc.create('A');
    await expect(svc.addDesign(p.id, new Blob(['{}'], { type: 'application/pdf' }), 'desktop')).rejects.toMatchObject({
      code: 'IMAGE_UNSUPPORTED',
    });
    const big = new Blob(['x'.repeat(200)], { type: 'image/png' });
    await expect(svc.addCapture(p.id, big, 'desktop')).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE' });
    expect(blobs.size).toBe(0);
    const got = await svc.get(p.id);
    expect(got?.designs).toEqual([]);
    expect(got?.captures).toEqual([]);
  });

  it('SPEC-PROJ-05: capture css width is the preset without a snapshot', async () => {
    const p = await svc.create('A');
    const c = await svc.addCapture(p.id, img(780), 'mobile');
    expect(c.image.cssWidth).toBe(390);
    expect(c.dom).toBeUndefined();
    expect(c.warnings).toEqual([]);
  });

  it('SPEC-PROJ-05: capture css width is the snapshot viewport width when a snapshot is given', async () => {
    const p = await svc.create('A');
    const c = await svc.addCapture(p.id, img(1000), 'desktop', domSnapshot({ viewport: { width: 1280, height: 800 } }));
    expect(c.image.cssWidth).toBe(1280);
    expect(c.dom?.viewport.width).toBe(1280);
    expect(c.warnings).toContain('dom-viewport-mismatch');
  });

  it('SPEC-PROJ-05: a snapshot within 1px of the preset gives no dom-viewport-mismatch', async () => {
    const p = await svc.create('A');
    const c = await svc.addCapture(p.id, img(1440), 'desktop', domSnapshot({ viewport: { width: 1441, height: 800 } }));
    expect(c.warnings).not.toContain('dom-viewport-mismatch');
  });

  it('SPEC-PROJ-05, SPEC-RUN-02: capture width further than width_mismatch_pct from the design adds width-mismatch', async () => {
    const p = await svc.create('A');
    await svc.addDesign(p.id, img(1440), 'desktop');
    const near = await svc.addCapture(
      p.id,
      img(1440),
      'desktop',
      domSnapshot({ viewport: { width: 1450, height: 800 } }),
    );
    expect(near.warnings).not.toContain('width-mismatch');
    const far = await svc.addCapture(
      p.id,
      img(1440),
      'desktop',
      domSnapshot({ viewport: { width: 1200, height: 800 } }),
    );
    expect(far.warnings).toContain('width-mismatch');
  });

  it('SPEC-PROJ-03, SPEC-PROJ-04: replacing a capture keeps one per viewport, deletes the old blob and keeps the contract', async () => {
    const p = await svc.create('A');
    await store.put({ ...p, activeContractId: 'contract-9' });
    const c1 = await svc.addCapture(p.id, img(1440), 'desktop');
    const c2 = await svc.addCapture(p.id, img(1440), 'desktop');
    const got = await svc.get(p.id);
    expect(got?.captures.map((c) => c.id)).toEqual([c2.id]);
    expect(got?.activeContractId).toBe('contract-9');
    expect(await blobs.get(c1.image.blobId)).toBeUndefined();
  });

  it('SPEC-PROJ-04: a replaced capture referenced by a Run keeps its blob', async () => {
    const p = await svc.create('A');
    const c1 = await svc.addCapture(p.id, img(1440), 'desktop');
    await store.putRun(run({ projectId: p.id, captureIds: [c1.id] }));
    await svc.addCapture(p.id, img(1440), 'desktop');
    expect(await blobs.get(c1.image.blobId)).toBeDefined();
  });

  it('SPEC-PROJ-04, PRD-F-02.6: replace marks only that viewport stale for the latest run', async () => {
    const p = await svc.create('A');
    const d = await svc.addCapture(p.id, img(1440), 'desktop');
    const m = await svc.addCapture(p.id, img(390), 'mobile');
    const r = run({
      projectId: p.id,
      captureIds: [d.id, m.id],
      results: [
        requirementResult({ requirementId: 'R-01', viewport: 'desktop' }),
        requirementResult({ requirementId: 'R-02', viewport: 'mobile' }),
      ],
    });
    await store.putRun(r);
    expect(staleViewports((await svc.get(p.id)) as never, r)).toEqual([]);
    await svc.addCapture(p.id, img(1440), 'desktop');
    expect(staleViewports((await svc.get(p.id)) as never, r)).toEqual(['desktop']);
    await svc.addCapture(p.id, img(390), 'mobile');
    expect(staleViewports((await svc.get(p.id)) as never, r).sort()).toEqual(['desktop', 'mobile']);
  });

  it('SPEC-PROJ-04: a viewport the run never captured is not stale, and no run means none stale', async () => {
    const p = await svc.create('A');
    const d = await svc.addCapture(p.id, img(1440), 'desktop');
    const r = run({ projectId: p.id, captureIds: [d.id] });
    await svc.addCapture(p.id, img(390), 'mobile');
    expect(staleViewports((await svc.get(p.id)) as never, r)).toEqual([]);
    expect(staleViewports((await svc.get(p.id)) as never, undefined)).toEqual([]);
  });

  it('SPEC-PROJ-05: attachSnapshot re-normalises when the width changes and replaces the blob', async () => {
    const p = await svc.create('A');
    const c = await svc.addCapture(p.id, img(2000), 'desktop');
    const out = await svc.attachSnapshot(p.id, c.id, domSnapshot({ viewport: { width: 1280, height: 800 } }));
    expect(out.id).toBe(c.id);
    expect(out.image.cssWidth).toBe(1280);
    expect(out.image.blobId).not.toBe(c.image.blobId);
    expect(await blobs.get(c.image.blobId)).toBeUndefined();
    expect(out.dom?.viewport.width).toBe(1280);
    expect(out.warnings).toContain('dom-viewport-mismatch');
    expect((await svc.get(p.id))?.captures[0]).toEqual(out);
  });

  it('SPEC-PROJ-05: attachSnapshot with an unchanged width keeps the blob; warnings follow the new snapshot', async () => {
    const p = await svc.create('A');
    const c = await svc.addCapture(p.id, img(1440), 'desktop', domSnapshot({ viewport: { width: 1200, height: 800 } }));
    const same = await svc.attachSnapshot(p.id, c.id, domSnapshot({ viewport: { width: 1200, height: 800 } }));
    expect(same.image.blobId).toBe(c.image.blobId);
    const back = await svc.attachSnapshot(p.id, c.id, domSnapshot({ viewport: { width: 1440, height: 800 } }));
    expect(back.warnings).toEqual([]);
    expect(back.image.cssWidth).toBe(1440);
  });

  it('SPEC-PROJ-05: attachSnapshot to an unknown capture fails with STORAGE_FAILED', async () => {
    const p = await svc.create('A');
    await expect(svc.attachSnapshot(p.id, 'nope', domSnapshot())).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });

  it('SPEC-PROJ-05: a re-normalised capture referenced by a Run keeps the old blob', async () => {
    const p = await svc.create('A');
    const c = await svc.addCapture(p.id, img(2000), 'desktop');
    await store.putRun(run({ projectId: p.id, captureIds: [c.id] }));
    await svc.attachSnapshot(p.id, c.id, domSnapshot({ viewport: { width: 1280, height: 800 } }));
    expect(await blobs.get(c.image.blobId)).toBeDefined();
  });
});

describe('suggestViewport', () => {
  const cases: [number, string][] = [
    [1440, 'desktop'],
    [2880, 'desktop'],
    [390, 'mobile'],
    [780, 'mobile'],
    [1170, 'mobile'],
    [1920, 'desktop'],
    [1100, 'desktop'],
    [600, 'mobile'],
    [0, 'desktop'],
  ];
  it.each(cases)('SPEC-MEAS-04, SPEC-KERNEL-12: source width %i suggests %s', async (w, expected) => {
    expect(await svc.suggestViewport(img(w))).toBe(expected);
  });

  it('SPEC-MEAS-04: an unreadable file rejects', async () => {
    await expect(svc.suggestViewport(new Blob(['not json'], { type: 'image/png' }))).rejects.toBeDefined();
  });
});

describe('cloud consent and usage', () => {
  const token = (projectId: string) => mintConsent({ scope: 'project', projectId }, { isTrusted: true });

  it('SPEC-PROJ-07, PRD-F-11.3: grant with a project token stores grantedAt only; revoke clears it', async () => {
    const p = await svc.create('A');
    await svc.grantCloudConsent(p.id, token(p.id));
    expect((await svc.get(p.id))?.cloudConsent).toEqual({ grantedAt: clock.now() });
    await svc.revokeCloudConsent(p.id);
    expect((await svc.get(p.id))?.cloudConsent).toBeUndefined();
  });

  it('SPEC-PROJ-07, PRD-M-06: an untrusted gesture cannot mint a token', () => {
    expect(() => mintConsent({ scope: 'project', projectId: 'p' }, { isTrusted: false })).toThrow(CuiError);
  });

  it('SPEC-PROJ-07, PRD-M-06: grant without a token, or with a deep, other-project or forged token, is rejected', async () => {
    const p = await svc.create('A');
    const o = await svc.create('B');
    const bad = [
      undefined,
      {},
      mintConsent({ scope: 'deep', runId: 'r' }, { isTrusted: true }),
      token(o.id),
      { __brand: 'consent', scope: 'project', projectId: p.id },
    ];
    for (const t of bad) {
      await expect(svc.grantCloudConsent(p.id, t as never)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    }
    expect((await svc.get(p.id))?.cloudConsent).toBeUndefined();
  });

  it('SPEC-PROJ-07, PRD-F-11.5: recordCloudUsage accumulates requests and bytes', async () => {
    const p = await svc.create('A');
    await svc.recordCloudUsage(p.id, 100);
    await svc.recordCloudUsage(p.id, 250);
    expect((await svc.get(p.id))?.cloudUsage).toEqual({ requests: 2, bytes: 350 });
  });

  it('SPEC-PROJ-07: negative or non-finite bytes count the request but add zero bytes', async () => {
    const p = await svc.create('A');
    await svc.recordCloudUsage(p.id, -5);
    await svc.recordCloudUsage(p.id, Number.NaN);
    expect((await svc.get(p.id))?.cloudUsage).toEqual({ requests: 2, bytes: 0 });
  });

  it('SPEC-PROJ-07: revoke keeps usage totals', async () => {
    const p = await svc.create('A');
    await svc.grantCloudConsent(p.id, token(p.id));
    await svc.recordCloudUsage(p.id, 10);
    await svc.revokeCloudConsent(p.id);
    expect((await svc.get(p.id))?.cloudUsage).toEqual({ requests: 1, bytes: 10 });
  });
});
