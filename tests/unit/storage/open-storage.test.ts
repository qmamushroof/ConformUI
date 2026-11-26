import 'fake-indexeddb/auto';
import { CuiError } from '@kernel';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openStorage } from '../../../src/platform/storage';
import { capture, contract, designRef, imageRef, project, run, settings } from '../../helpers/samples';

type Skipper = { skippedCount(): number };

async function rawPut(store: string, value: unknown, key?: string) {
  const db = await openDB('conformui', 1);
  await db.put(store, value, key);
  db.close();
}

async function rawCount(store: string) {
  const db = await openDB('conformui', 1);
  const n = await db.count(store);
  db.close();
  return n;
}

const blobOf = (s: string) => new Blob([s], { type: 'image/png' });

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SPEC-STORE-01 schema', () => {
  it('SPEC-STORE-01: creates conformui v1 with stores and indexes', async () => {
    await openStorage();
    const db = await openDB('conformui', 1);
    expect(db.version).toBe(1);
    expect([...db.objectStoreNames].sort()).toEqual(['blobs', 'contracts', 'projects', 'runs', 'settings']);
    const tx = db.transaction(['projects', 'contracts', 'runs'], 'readonly');
    expect([...tx.objectStore('projects').indexNames]).toEqual(['byUpdatedAt']);
    expect([...tx.objectStore('contracts').indexNames]).toEqual(['byProject']);
    expect([...tx.objectStore('runs').indexNames].sort()).toEqual(['byProject', 'byProjectCreatedAt']);
    expect(tx.objectStore('runs').index('byProjectCreatedAt').keyPath).toEqual(['projectId', 'createdAt']);
    db.close();
  });

  it('SPEC-STORE-01: reopening an existing database keeps its data', async () => {
    const a = await openStorage();
    await a.projects.put(project());
    const b = await openStorage();
    expect((await b.projects.get('project-1'))?.name).toBe('Sample landing page');
  });

  it('SPEC-STORE-01: a newer database opens read-only: reads work, writes fail with STORAGE_FAILED', async () => {
    const seed = await openStorage();
    await seed.projects.put(project());
    const newer = await openDB('conformui', 2);
    newer.close();

    const s = await openStorage();
    expect((await s.projects.get('project-1'))?.id).toBe('project-1');
    expect(await s.projects.list()).toHaveLength(1);
    await expect(s.projects.put(project({ id: 'p2' }))).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    await expect(s.projects.remove('project-1')).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    await expect(s.blobs.put(blobOf('x'))).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    await expect(s.settings.write({ onboarded: true })).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    await expect(s.projects.clearAll()).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    expect(await s.projects.get('project-1')).toBeDefined();
  });
});

describe('SPEC-STORE-02 stores', () => {
  it('SPEC-STORE-02: ProjectStore round-trips project, contract and run; unknown ids are undefined', async () => {
    const { projects } = await openStorage();
    await projects.put(project());
    await projects.putContract(contract());
    await projects.putRun(run());
    expect(await projects.get('project-1')).toEqual(project());
    expect(await projects.getContract('contract-1')).toEqual(contract());
    expect(await projects.getRun(run().id)).toEqual(run());
    expect(await projects.get('nope')).toBeUndefined();
    expect(await projects.getContract('nope')).toBeUndefined();
    expect(await projects.getRun('nope')).toBeUndefined();
  });

  it('SPEC-STORE-02: put overwrites the same id', async () => {
    const { projects } = await openStorage();
    await projects.put(project({ name: 'a' }));
    await projects.put(project({ name: 'b' }));
    expect(await projects.list()).toHaveLength(1);
    expect((await projects.get('project-1'))?.name).toBe('b');
  });

  it('SPEC-STORE-02: list is sorted by updatedAt descending; empty store lists []', async () => {
    const { projects } = await openStorage();
    expect(await projects.list()).toEqual([]);
    await projects.put(project({ id: 'old', updatedAt: 1 }));
    await projects.put(project({ id: 'new', updatedAt: 3 }));
    await projects.put(project({ id: 'mid', updatedAt: 2 }));
    expect((await projects.list()).map((p) => p.id)).toEqual(['new', 'mid', 'old']);
  });

  it('SPEC-STORE-02: listRuns returns only that project, newest first', async () => {
    const { projects } = await openStorage();
    await projects.putRun(run({ id: 'r1', projectId: 'a', createdAt: 1 }));
    await projects.putRun(run({ id: 'r2', projectId: 'a', createdAt: 5 }));
    await projects.putRun(run({ id: 'r3', projectId: 'b', createdAt: 9 }));
    expect((await projects.listRuns('a')).map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(await projects.listRuns('none')).toEqual([]);
  });

  it('SPEC-STORE-02: BlobStore round-trips a blob under a generated unique id and removes it', async () => {
    const { blobs } = await openStorage();
    const a = await blobs.put(blobOf('hello'));
    const b = await blobs.put(blobOf('world'));
    expect(a).not.toBe(b);
    const got = await blobs.get(a);
    expect(got?.size).toBe(5);
    expect(await blobs.get('missing')).toBeUndefined();
    await blobs.remove(a);
    expect(await blobs.get(a)).toBeUndefined();
    expect(await blobs.get(b)).toBeDefined();
    await expect(blobs.remove('missing')).resolves.toBeUndefined();
  });

  it('SPEC-STORE-02: SettingsStore returns defaults first, then merges partial writes', async () => {
    const { settings: store } = await openStorage();
    expect(await store.read()).toEqual(settings({ onboarded: false, deepUsage: { day: '', count: 0 } }));
    await store.write({ onboarded: true });
    await store.write({ deepUsage: { day: '2026-01-02', count: 2 } });
    expect(await store.read()).toMatchObject({ onboarded: true, deepUsage: { day: '2026-01-02', count: 2 } });
  });

  it('SPEC-STORE-02: remove(projectId) cascades contracts, runs and referenced blobs, leaving no orphans', async () => {
    const { projects, blobs } = await openStorage();
    const d = await blobs.put(blobOf('d'));
    const c = await blobs.put(blobOf('c'));
    const other = await blobs.put(blobOf('o'));
    await projects.put(
      project({
        designs: [designRef({ image: imageRef({ blobId: d }) })],
        captures: [capture({ image: imageRef({ blobId: c }) })],
      }),
    );
    await projects.put(
      project({ id: 'p2', designs: [designRef({ id: 'd2', image: imageRef({ blobId: other }) })], captures: [] }),
    );
    await projects.putContract(contract());
    await projects.putContract(contract({ id: 'contract-2', projectId: 'p2' }));
    await projects.putRun(run({ id: 'r1', projectId: 'project-1' }));
    await projects.putRun(run({ id: 'r2', projectId: 'p2' }));

    await projects.remove('project-1');

    expect(await projects.get('project-1')).toBeUndefined();
    expect(await projects.getContract('contract-1')).toBeUndefined();
    expect(await projects.getRun('r1')).toBeUndefined();
    expect(await blobs.get(d)).toBeUndefined();
    expect(await blobs.get(c)).toBeUndefined();
    expect(await projects.get('p2')).toBeDefined();
    expect(await projects.getContract('contract-2')).toBeDefined();
    expect(await projects.getRun('r2')).toBeDefined();
    expect(await blobs.get(other)).toBeDefined();
    expect(await rawCount('blobs')).toBe(1);
  });

  it('SPEC-STORE-02: remove of an unknown project is a no-op', async () => {
    const { projects } = await openStorage();
    await projects.put(project());
    await expect(projects.remove('nope')).resolves.toBeUndefined();
    expect(await projects.list()).toHaveLength(1);
  });

  it('SPEC-STORE-02: remove is one transaction: a failure part-way leaves everything intact', async () => {
    const { projects, blobs } = await openStorage();
    const d = await blobs.put(blobOf('d'));
    await projects.put(project({ designs: [designRef({ image: imageRef({ blobId: d }) })], captures: [] }));
    await projects.putContract(contract());
    const orig = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (this: IDBObjectStore, k: IDBValidKey | IDBKeyRange) {
      if (this.name === 'blobs') throw new Error('boom');
      return orig.call(this, k);
    };
    try {
      await expect(projects.remove('project-1')).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    } finally {
      IDBObjectStore.prototype.delete = orig;
    }
    expect(await projects.get('project-1')).toBeDefined();
    expect(await projects.getContract('contract-1')).toBeDefined();
    expect(await blobs.get(d)).toBeDefined();
  });

  it('SPEC-STORE-02, PRD-D-27: clearAll empties all stores but keeps settings.deepUsage', async () => {
    const { projects, blobs, settings: st } = await openStorage();
    const b = await blobs.put(blobOf('x'));
    await projects.put(project());
    await projects.putContract(contract());
    await projects.putRun(run());
    await st.write({ onboarded: true, everSentToCloud: true, deepUsage: { day: '2026-01-02', count: 3 } });
    await projects.clearAll();
    expect(await projects.list()).toEqual([]);
    expect(await projects.getContract('contract-1')).toBeUndefined();
    expect(await projects.getRun(run().id)).toBeUndefined();
    expect(await blobs.get(b)).toBeUndefined();
    expect((await st.read()).deepUsage).toEqual({ day: '2026-01-02', count: 3 });
  });

  it('SPEC-STORE-02: stored values are clones; mutating the written value does not change storage', async () => {
    const { projects } = await openStorage();
    const p = project();
    await projects.put(p);
    p.name = 'mutated';
    expect((await projects.get('project-1'))?.name).toBe('Sample landing page');
  });
});

describe('SPEC-STORE-03 validated reads', () => {
  it('SPEC-STORE-03: an invalid project is skipped and counted, list does not throw', async () => {
    const s = await openStorage();
    await s.projects.put(project());
    await rawPut('projects', { id: 'bad', name: 5 });
    const list = await s.projects.list();
    expect(list.map((p) => p.id)).toEqual(['project-1']);
    expect((s.projects as unknown as Skipper).skippedCount()).toBe(1);
  });

  it('SPEC-STORE-03: get of an invalid record returns undefined and counts', async () => {
    const s = await openStorage();
    await rawPut('projects', { id: 'bad' });
    await rawPut('contracts', { id: 'bad' });
    await rawPut('runs', { id: 'bad', projectId: 'x' });
    expect(await s.projects.get('bad')).toBeUndefined();
    expect(await s.projects.getContract('bad')).toBeUndefined();
    expect(await s.projects.getRun('bad')).toBeUndefined();
    expect((s.projects as unknown as Skipper).skippedCount()).toBe(3);
  });

  it('SPEC-STORE-03: invalid runs are skipped in listRuns', async () => {
    const s = await openStorage();
    await s.projects.putRun(run({ id: 'ok', projectId: 'a' }));
    await rawPut('runs', { id: 'bad', projectId: 'a', createdAt: 1 });
    expect((await s.projects.listRuns('a')).map((r) => r.id)).toEqual(['ok']);
    expect((s.projects as unknown as Skipper).skippedCount()).toBe(1);
  });

  it('SPEC-STORE-03: corrupt settings fall back to defaults', async () => {
    const s = await openStorage();
    await rawPut('settings', { mode: 'nonsense' }, 'main');
    expect((await s.settings.read()).mode).toBe('auto');
  });

  it('SPEC-STORE-03: a blob record without a Blob reads as undefined', async () => {
    const s = await openStorage();
    await rawPut('blobs', { id: 'b1', blob: 'not a blob' });
    expect(await s.blobs.get('b1')).toBeUndefined();
  });

  it('SPEC-STORE-03: writing an invalid value is rejected with STORAGE_FAILED', async () => {
    const s = await openStorage();
    await expect(s.projects.put({ id: 'x' } as never)).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });
});

describe('SPEC-STORE-04 errors and persist', () => {
  it('SPEC-STORE-04: open failure maps to CuiError STORAGE_UNAVAILABLE with no store touched', async () => {
    const open = vi.fn(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.stubGlobal('indexedDB', { open });
    const err = await openStorage().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CuiError);
    expect(err).toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('SPEC-STORE-04: an open request error event maps to STORAGE_UNAVAILABLE', async () => {
    vi.stubGlobal('indexedDB', {
      open() {
        const req: Record<string, unknown> = {};
        queueMicrotask(() => {
          req.error = new DOMException('x', 'UnknownError');
          (req.onerror as (() => void) | undefined)?.();
        });
        return req;
      },
    });
    await expect(openStorage()).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  });

  it('SPEC-STORE-04: a missing indexedDB maps to STORAGE_UNAVAILABLE', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(openStorage()).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  });

  it('SPEC-STORE-04: a failing operation after open maps to STORAGE_FAILED (a CuiError, no raw error)', async () => {
    const s = await openStorage();
    const orig = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = () => {
      throw new DOMException('gone', 'InvalidStateError');
    };
    try {
      const err = await s.projects.list().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(CuiError);
      expect(err).toMatchObject({ code: 'STORAGE_FAILED' });
    } finally {
      IDBDatabase.prototype.transaction = orig;
    }
  });

  it('SPEC-STORE-04: persist() is requested once, after the first Project is created', async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', { storage: { persist } });
    const s = await openStorage();
    await s.blobs.put(blobOf('x'));
    await s.settings.write({ onboarded: true });
    expect(persist).not.toHaveBeenCalled();
    await s.projects.put(project());
    expect(persist).toHaveBeenCalledTimes(1);
    await s.projects.put(project({ id: 'p2' }));
    await s.projects.put(project({ name: 'renamed' }));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('SPEC-STORE-04: persist() missing or throwing never fails the write', async () => {
    vi.stubGlobal('navigator', { storage: {} });
    const a = await openStorage();
    await expect(a.projects.put(project())).resolves.toBeUndefined();
    vi.stubGlobal('navigator', {
      storage: {
        persist: () => {
          throw new Error('no');
        },
      },
    });
    const b = await openStorage();
    await expect(b.projects.put(project({ id: 'p9' }))).resolves.toBeUndefined();
  });
});

describe('SPEC-STORE-05 no network', () => {
  it('SPEC-STORE-05: storage never calls fetch', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const s = await openStorage();
    await s.projects.put(project());
    await s.projects.list();
    await s.blobs.put(blobOf('x'));
    await s.settings.read();
    expect(f).not.toHaveBeenCalled();
  });
});
