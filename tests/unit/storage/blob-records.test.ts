import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openStorage } from '../../../src/platform/storage';

async function rawGet(id: string): Promise<Record<string, unknown> | undefined> {
  const db = await openDB('conformui', 1);
  const row = await db.get('blobs', id);
  db.close();
  return row;
}

async function bytesOf(b: Blob): Promise<number[]> {
  return [...new Uint8Array(await b.arrayBuffer())];
}

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('portable blob records (WebKit cannot store Blobs in IndexedDB)', () => {
  it('writes bytes and type, never a Blob', async () => {
    const { blobs } = await openStorage();
    const id = await blobs.put(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    const row = await rawGet(id);
    expect(row?.blob).toBeUndefined();
    expect(row?.bytes).toBeInstanceOf(ArrayBuffer);
    expect(row?.type).toBe('image/png');
  });

  it('round-trips bytes and type', async () => {
    const { blobs } = await openStorage();
    const id = await blobs.put(new Blob([new Uint8Array([0, 255, 128, 7])], { type: 'image/webp' }));
    const got = await blobs.get(id);
    expect(got).toBeInstanceOf(Blob);
    expect(got?.type).toBe('image/webp');
    expect(await bytesOf(got as Blob)).toEqual([0, 255, 128, 7]);
  });

  it('round-trips an empty blob and an empty type', async () => {
    const { blobs } = await openStorage();
    const id = await blobs.put(new Blob([]));
    const got = await blobs.get(id);
    expect(got).toBeInstanceOf(Blob);
    expect(got?.size).toBe(0);
    expect(got?.type).toBe('');
  });

  it('round-trips a large image (8 MiB)', async () => {
    const { blobs } = await openStorage();
    const data = new Uint8Array(8 * 1024 * 1024);
    for (let i = 0; i < data.length; i += 4099) data[i] = i % 251;
    const id = await blobs.put(new Blob([data], { type: 'image/png' }));
    const got = await blobs.get(id);
    expect(got?.size).toBe(data.length);
    const back = new Uint8Array(await (got as Blob).arrayBuffer());
    expect(back[4099]).toBe(4099 % 251);
    expect(back[data.length - 1]).toBe(data[data.length - 1]);
  });

  it('still reads a legacy record that holds a Blob', async () => {
    await openStorage();
    const db = await openDB('conformui', 1);
    await db.put('blobs', { id: 'old', blob: new Blob(['legacy'], { type: 'image/png' }) });
    db.close();
    const { blobs } = await openStorage();
    const got = await blobs.get('old');
    expect(got?.type).toBe('image/png');
    expect(await got?.text()).toBe('legacy');
  });

  it('reads a malformed record as undefined', async () => {
    await openStorage();
    const db = await openDB('conformui', 1);
    await db.put('blobs', { id: 'bad', bytes: 'nope', type: 3 });
    await db.put('blobs', { id: 'bad2' });
    db.close();
    const { blobs } = await openStorage();
    expect(await blobs.get('bad')).toBeUndefined();
    expect(await blobs.get('bad2')).toBeUndefined();
  });

  it('error path: an unreadable blob rejects with STORAGE_FAILED and nothing is written', async () => {
    const { blobs } = await openStorage();
    const broken = new Blob(['x']);
    vi.spyOn(broken, 'arrayBuffer').mockRejectedValue(new Error('read failed'));
    await expect(blobs.put(broken)).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    const db = await openDB('conformui', 1);
    expect(await db.count('blobs')).toBe(0);
    db.close();
  });
});
