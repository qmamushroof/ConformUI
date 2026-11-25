import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIds } from '../../helpers/clock-ids';
import { InMemoryBlobStore, InMemoryProjectStore, InMemorySettingsStore } from '../../helpers/memory-stores';
import * as s from '../../helpers/samples';

// Step-0 test helpers (SPEC §7.1 "services with fakes"): in-memory ports with the semantics the real adapters give.

describe('SPEC-TEST-01: fixed Clock and Ids', () => {
  it('SPEC-TEST-01: fixedClock returns the same instant until advanced', () => {
    const clock = fixedClock(1000);
    expect(clock.now()).toBe(1000);
    expect(clock.now()).toBe(1000);
    clock.advance(500);
    expect(clock.now()).toBe(1500);
  });

  it('SPEC-TEST-01: sequentialIds counts from 1 with a prefix and never repeats', () => {
    const ids = sequentialIds('x');
    expect([ids.next(), ids.next(), ids.next()]).toEqual(['x-1', 'x-2', 'x-3']);
    expect(sequentialIds().next()).toBe('id-1');
  });
});

describe('SPEC-STORE-01: InMemoryProjectStore', () => {
  it('SPEC-STORE-01: put/get/list round trip with copies (mutating a read does not change the store)', async () => {
    const store = new InMemoryProjectStore();
    const p = s.project();
    await store.put(p);
    const got = await store.get('project-1');
    expect(got).toEqual(p);
    if (got) got.name = 'changed';
    expect((await store.get('project-1'))?.name).toBe('Sample landing page');
    expect(await store.list()).toHaveLength(1);
    expect(await store.get('missing')).toBeUndefined();
  });

  it('SPEC-STORE-01: list is newest first by updatedAt', async () => {
    const store = new InMemoryProjectStore();
    await store.put(s.project({ id: 'a', updatedAt: 1 }));
    await store.put(s.project({ id: 'b', updatedAt: 3 }));
    await store.put(s.project({ id: 'c', updatedAt: 2 }));
    expect((await store.list()).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('SPEC-STORE-01: contracts and runs round trip; listRuns filters by project, newest first', async () => {
    const store = new InMemoryProjectStore();
    await store.putContract(s.contract());
    expect(await store.getContract('contract-1')).toEqual(s.contract());
    await store.putRun(s.run({ id: 'r1', createdAt: 1 }));
    await store.putRun(s.run({ id: 'r2', createdAt: 2 }));
    await store.putRun(s.run({ id: 'r3', projectId: 'other', createdAt: 3 }));
    expect((await store.listRuns('project-1')).map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(await store.getRun('r3')).toBeDefined();
    expect(await store.getRun('nope')).toBeUndefined();
  });

  it('SPEC-STORE-02: remove cascades to the project contracts and runs, and leaves other projects alone', async () => {
    const store = new InMemoryProjectStore();
    await store.put(s.project({ id: 'p1' }));
    await store.put(s.project({ id: 'p2' }));
    await store.putContract(s.contract({ id: 'c1', projectId: 'p1' }));
    await store.putContract(s.contract({ id: 'c2', projectId: 'p2' }));
    await store.putRun(s.run({ id: 'r1', projectId: 'p1' }));
    await store.putRun(s.run({ id: 'r2', projectId: 'p2' }));
    await store.remove('p1');
    expect(await store.get('p1')).toBeUndefined();
    expect(await store.getContract('c1')).toBeUndefined();
    expect(await store.getRun('r1')).toBeUndefined();
    expect(await store.get('p2')).toBeDefined();
    expect(await store.getContract('c2')).toBeDefined();
    expect(await store.getRun('r2')).toBeDefined();
  });

  it('SPEC-STORE-01: removing an unknown project is a no-op; clearAll empties everything', async () => {
    const store = new InMemoryProjectStore();
    await store.remove('ghost');
    await store.put(s.project());
    await store.putContract(s.contract());
    await store.putRun(s.run());
    await store.clearAll();
    expect(await store.list()).toEqual([]);
    expect(await store.getContract('contract-1')).toBeUndefined();
    expect(await store.getRun('run-1')).toBeUndefined();
  });
});

describe('SPEC-STORE-01: InMemoryBlobStore', () => {
  it('SPEC-STORE-01: put returns a fresh id; get returns the blob; remove deletes it', async () => {
    const blobs = new InMemoryBlobStore();
    const a = await blobs.put(new Blob(['a']));
    const b = await blobs.put(new Blob(['b']));
    expect(a).not.toBe(b);
    expect(await (await blobs.get(a))?.text()).toBe('a');
    await blobs.remove(a);
    expect(await blobs.get(a)).toBeUndefined();
    expect(await (await blobs.get(b))?.text()).toBe('b');
    expect(blobs.size).toBe(1);
  });

  it('SPEC-STORE-01: removing an unknown id is a no-op', async () => {
    const blobs = new InMemoryBlobStore();
    await blobs.remove('ghost');
    expect(blobs.size).toBe(0);
  });
});

describe('SPEC-STORE-01: InMemorySettingsStore', () => {
  it('SPEC-STORE-01: read returns the defaults; write merges a partial', async () => {
    const store = new InMemorySettingsStore();
    expect(await store.read()).toEqual({
      mode: 'auto',
      onboarded: false,
      deepUsage: { day: '', count: 0 },
      everSentToCloud: false,
    });
    await store.write({ onboarded: true });
    await store.write({ mode: 'cloud-only' });
    expect(await store.read()).toMatchObject({ mode: 'cloud-only', onboarded: true, everSentToCloud: false });
  });

  it('SPEC-STORE-01: reads are copies and an initial value can be supplied', async () => {
    const store = new InMemorySettingsStore(s.settings({ onboarded: true }));
    const a = await store.read();
    a.onboarded = false;
    expect((await store.read()).onboarded).toBe(true);
  });
});
