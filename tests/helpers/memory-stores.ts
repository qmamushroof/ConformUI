import type { BlobStore, Contract, Project, ProjectStore, Run, Settings, SettingsStore } from '@kernel';

// In-memory ports for service tests. Like IndexedDB they store structured clones, so a caller mutating a value it
// read (or wrote) cannot change what is stored.

export class InMemoryProjectStore implements ProjectStore {
  private projects = new Map<string, Project>();
  private contracts = new Map<string, Contract>();
  private runs = new Map<string, Run>();

  async put(p: Project): Promise<void> {
    this.projects.set(p.id, structuredClone(p));
  }
  async get(id: string): Promise<Project | undefined> {
    return clone(this.projects.get(id));
  }
  async list(): Promise<Project[]> {
    return [...this.projects.values()].map((p) => structuredClone(p)).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async remove(id: string): Promise<void> {
    this.projects.delete(id);
    for (const [cid, c] of this.contracts) if (c.projectId === id) this.contracts.delete(cid);
    for (const [rid, r] of this.runs) if (r.projectId === id) this.runs.delete(rid);
  }
  async putContract(c: Contract): Promise<void> {
    this.contracts.set(c.id, structuredClone(c));
  }
  async getContract(id: string): Promise<Contract | undefined> {
    return clone(this.contracts.get(id));
  }
  async putRun(r: Run): Promise<void> {
    this.runs.set(r.id, structuredClone(r));
  }
  async getRun(id: string): Promise<Run | undefined> {
    return clone(this.runs.get(id));
  }
  async listRuns(projectId: string): Promise<Run[]> {
    return [...this.runs.values()]
      .filter((r) => r.projectId === projectId)
      .map((r) => structuredClone(r))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  async clearAll(): Promise<void> {
    this.projects.clear();
    this.contracts.clear();
    this.runs.clear();
  }
}

export class InMemoryBlobStore implements BlobStore {
  private blobs = new Map<string, Blob>();
  private n = 0;

  get size(): number {
    return this.blobs.size;
  }
  async put(blob: Blob): Promise<string> {
    const id = `blob-${++this.n}`;
    this.blobs.set(id, blob);
    return id;
  }
  async get(id: string): Promise<Blob | undefined> {
    return this.blobs.get(id);
  }
  async remove(id: string): Promise<void> {
    this.blobs.delete(id);
  }
}

export const DEFAULT_TEST_SETTINGS: Settings = {
  mode: 'auto',
  onboarded: false,
  deepUsage: { day: '', count: 0 },
  everSentToCloud: false,
};

export class InMemorySettingsStore implements SettingsStore {
  private value: Settings;

  constructor(initial: Settings = DEFAULT_TEST_SETTINGS) {
    this.value = structuredClone(initial);
  }
  async read(): Promise<Settings> {
    return structuredClone(this.value);
  }
  async write(s: Partial<Settings>): Promise<void> {
    this.value = { ...this.value, ...structuredClone(s) };
  }
}

function clone<T>(v: T | undefined): T | undefined {
  return v === undefined ? undefined : structuredClone(v);
}
