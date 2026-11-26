import {
  type BlobStore,
  type Contract,
  ContractSchema,
  CuiError,
  type Project,
  ProjectSchema,
  type ProjectStore,
  type Run,
  RunSchema,
  type Settings,
  SettingsSchema,
  type SettingsStore,
} from '@kernel';
import { type DBSchema, type IDBPDatabase, type IDBPTransaction, openDB, type StoreNames } from 'idb';

// Public API of platform/storage (SPEC §4.6.1). IndexedDB adapter (SPEC-STORE-01..05). No network (SPEC-STORE-05).

const DB_NAME = 'conformui';
const DB_VERSION = 1;
const SETTINGS_KEY = 'main';

interface CuiDb extends DBSchema {
  projects: { key: string; value: unknown; indexes: { byUpdatedAt: number } };
  contracts: { key: string; value: unknown; indexes: { byProject: string } };
  runs: {
    key: string;
    value: unknown;
    indexes: { byProject: string; byProjectCreatedAt: [string, number] };
  };
  blobs: { key: string; value: { id: string; blob: Blob } };
  settings: { key: string; value: unknown };
}

// Structural view of a kernel zod schema (zod itself is not imported outside the kernel).
interface Schema<T> {
  safeParse(v: unknown): { success: true; data: T } | { success: false; error: unknown };
}

type Db = IDBPDatabase<CuiDb>;
type Stores = StoreNames<CuiDb>;
type Tx = IDBPTransaction<CuiDb, Stores[], 'readwrite'>;

const DEFAULT_SETTINGS: Settings = {
  mode: 'auto',
  onboarded: false,
  deepUsage: { day: '', count: 0 },
  everSentToCloud: false,
};

function upgrade(db: Db, oldVersion: number): void {
  // New versions append cases below; never edit an earlier one.
  switch (oldVersion) {
    case 0: {
      db.createObjectStore('projects', { keyPath: 'id' }).createIndex('byUpdatedAt', 'updatedAt');
      db.createObjectStore('contracts', { keyPath: 'id' }).createIndex('byProject', 'projectId');
      const runs = db.createObjectStore('runs', { keyPath: 'id' });
      runs.createIndex('byProject', 'projectId');
      runs.createIndex('byProjectCreatedAt', ['projectId', 'createdAt']);
      db.createObjectStore('blobs', { keyPath: 'id' });
      db.createObjectStore('settings');
    }
  }
}

async function open(): Promise<{ db: Db; readOnly: boolean }> {
  // A newer tab upgrading the database must not be blocked by this connection.
  const blocking = (_v: number, _b: number | null, event: IDBVersionChangeEvent): void =>
    (event.target as IDBDatabase | null)?.close();
  try {
    try {
      return { db: await openDB<CuiDb>(DB_NAME, DB_VERSION, { upgrade, blocking }), readOnly: false };
    } catch (e) {
      if ((e as { name?: string } | null)?.name !== 'VersionError') throw e;
      // Database written by a newer app: open at its own version, read-only (SPEC-STORE-01).
      return { db: await openDB<CuiDb>(DB_NAME, undefined, { blocking }), readOnly: true };
    }
  } catch (cause) {
    throw new CuiError('STORAGE_UNAVAILABLE', 'Storage could not be opened', { cause });
  }
}

export async function openStorage(): Promise<{ projects: ProjectStore; blobs: BlobStore; settings: SettingsStore }> {
  const { db, readOnly } = await open();
  let skipped = 0;
  let persistAsked = false;

  const fail = (cause: unknown): CuiError =>
    cause instanceof CuiError ? cause : new CuiError('STORAGE_FAILED', 'Storage operation failed', { cause });

  async function guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      throw fail(e);
    }
  }

  function guardWrite<T>(fn: () => Promise<T>): Promise<T> {
    if (readOnly) return Promise.reject(new CuiError('STORAGE_FAILED', 'Storage is read-only: update the app'));
    return guard(fn);
  }

  function parse<T>(schema: Schema<T>, raw: unknown): T | undefined {
    if (raw === undefined) return undefined;
    const r = schema.safeParse(raw);
    if (r.success) return r.data;
    skipped += 1;
    return undefined;
  }

  function parseAll<T>(schema: Schema<T>, rows: unknown[]): T[] {
    const out: T[] = [];
    for (const row of rows) {
      const v = parse(schema, row);
      if (v !== undefined) out.push(v);
    }
    return out;
  }

  // Validate on write so nothing unreadable is ever stored.
  function check<T>(schema: Schema<T>, value: unknown): T {
    const r = schema.safeParse(value);
    if (!r.success) throw new CuiError('STORAGE_FAILED', 'Invalid record', { cause: r.error });
    return r.data;
  }

  function requestPersist(): void {
    if (persistAsked) return;
    persistAsked = true;
    try {
      void Promise.resolve(navigator.storage?.persist?.()).catch(() => undefined);
    } catch {
      // Best effort only (SPEC-STORE-04).
    }
  }

  async function readSettings(): Promise<Settings> {
    const raw = await db.get('settings', SETTINGS_KEY);
    return parse(SettingsSchema, raw) ?? structuredClone(DEFAULT_SETTINGS);
  }

  const projects: ProjectStore & { skippedCount(): number } = {
    skippedCount: () => skipped,
    put: (p) =>
      guardWrite(async () => {
        const value = check(ProjectSchema, p);
        const existed = (await db.getKey('projects', value.id)) !== undefined;
        await db.put('projects', value);
        if (!existed) requestPersist();
      }),
    get: (id) => guard(async () => parse<Project>(ProjectSchema, await db.get('projects', id))),
    list: () =>
      guard(async () => {
        const rows = parseAll<Project>(ProjectSchema, await db.getAll('projects'));
        return rows.sort((a, b) => b.updatedAt - a.updatedAt);
      }),
    remove: (id) =>
      guardWrite(async () => {
        const tx: Tx = db.transaction(['projects', 'contracts', 'runs', 'blobs'], 'readwrite');
        try {
          const project = parse<Project>(ProjectSchema, await tx.objectStore('projects').get(id));
          const blobIds = project
            ? [...project.designs.map((d) => d.image.blobId), ...project.captures.map((c) => c.image.blobId)]
            : [];
          for (const store of ['contracts', 'runs'] as const) {
            const keys = await tx.objectStore(store).index('byProject').getAllKeys(id);
            for (const k of keys) await tx.objectStore(store).delete(k);
          }
          for (const b of blobIds) await tx.objectStore('blobs').delete(b);
          await tx.objectStore('projects').delete(id);
          await tx.done;
        } catch (e) {
          try {
            tx.abort();
          } catch {
            // Already finished.
          }
          await tx.done.catch(() => undefined);
          throw e;
        }
      }),
    putContract: (c) => guardWrite(async () => void (await db.put('contracts', check(ContractSchema, c)))),
    getContract: (id) => guard(async () => parse<Contract>(ContractSchema, await db.get('contracts', id))),
    putRun: (r) => guardWrite(async () => void (await db.put('runs', check(RunSchema, r)))),
    getRun: (id) => guard(async () => parse<Run>(RunSchema, await db.get('runs', id))),
    listRuns: (projectId) =>
      guard(async () => {
        const range = IDBKeyRange.bound([projectId, -Infinity], [projectId, Infinity]);
        const rows = await db.getAllFromIndex('runs', 'byProjectCreatedAt', range);
        return parseAll<Run>(RunSchema, rows).reverse();
      }),
    clearAll: () =>
      guardWrite(async () => {
        const tx = db.transaction(['projects', 'contracts', 'runs', 'blobs', 'settings'], 'readwrite');
        const kept = parse(SettingsSchema, await tx.objectStore('settings').get(SETTINGS_KEY));
        for (const s of ['projects', 'contracts', 'runs', 'blobs'] as const) await tx.objectStore(s).clear();
        await tx
          .objectStore('settings')
          .put({ ...DEFAULT_SETTINGS, deepUsage: kept?.deepUsage ?? DEFAULT_SETTINGS.deepUsage }, SETTINGS_KEY);
        await tx.done;
      }),
  };

  const blobs: BlobStore = {
    put: (blob) =>
      guardWrite(async () => {
        const id = crypto.randomUUID();
        await db.put('blobs', { id, blob });
        return id;
      }),
    get: (id) =>
      guard(async () => {
        const row = await db.get('blobs', id);
        return row?.blob instanceof Blob ? row.blob : undefined;
      }),
    remove: (id) => guardWrite(() => db.delete('blobs', id)),
  };

  const settings: SettingsStore = {
    read: () => guard(readSettings),
    write: (patch) =>
      guardWrite(async () => {
        const next = check(SettingsSchema, { ...(await readSettings()), ...patch });
        await db.put('settings', next, SETTINGS_KEY);
      }),
  };

  return { projects, blobs, settings };
}
