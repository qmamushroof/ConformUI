import {
  type BlobStore,
  type Capture,
  type Clock,
  type ConsentToken,
  CuiError,
  DEFAULT_RUNTIME_VALUES,
  type DesignRef,
  type DomSnapshot,
  type Ids,
  type ImageCodec,
  type Project,
  type ProjectStore,
  type Run,
  suggestViewport,
  VIEWPORT_PRESETS,
  type ViewportId,
} from '@kernel';

// Public API of features/projects (SPEC §4.6.1). Bodies: lane C (task 11.x). UI components: lane C (./ui).

export * from './ui';

export interface ProjectsDeps {
  store: ProjectStore;
  blobs: BlobStore;
  codec: ImageCodec;
  clock: Clock;
  ids: Ids;
}

export interface ProjectSummary {
  id: string;
  name: string;
  viewports: ViewportId[];
  lastRun?: { at: number; pass: number; fail: number; review: number };
  isSample: boolean;
}

export interface ProjectsService {
  list(): Promise<ProjectSummary[]>; // PRD-F-01.2
  create(name: string): Promise<Project>;
  get(id: string): Promise<Project | undefined>;
  remove(id: string): Promise<void>; // cascade (PRD-F-01.1)
  rename(id: string, name: string): Promise<void>; // [P1] PRD-F-01.3
  addDesign(projectId: string, file: Blob, viewport: ViewportId): Promise<DesignRef>;
  addCapture(projectId: string, file: Blob, viewport: ViewportId, dom?: DomSnapshot): Promise<Capture>; // replaces same viewport
  attachSnapshot(projectId: string, captureId: string, dom: DomSnapshot): Promise<Capture>;
  suggestViewport(file: Blob): Promise<ViewportId>; // SPEC-MEAS-04
  grantCloudConsent(projectId: string, token: ConsentToken): Promise<void>;
  revokeCloudConsent(projectId: string): Promise<void>;
  recordCloudUsage(projectId: string, bytes: number): Promise<void>;
}

const MAX_NAME = 80;

/**
 * Viewports whose capture was replaced after `latest` ran (SPEC-PROJ-04, PRD-F-02.6). Derived, never stored: a Run
 * keeps the `captureIds` it used, so a viewport it covered is stale when the Project's current capture there is not
 * one of them.
 */
export function staleViewports(project: Project, latest: Run | undefined): ViewportId[] {
  if (!latest) return [];
  const used = new Set(latest.captureIds);
  const covered = new Set(latest.results.map((r) => r.viewport));
  return project.captures.filter((c) => covered.has(c.viewport) && !used.has(c.id)).map((c) => c.viewport);
}

const notFound = () => new CuiError('STORAGE_FAILED', 'Project not found');

export function createProjectsService(d: ProjectsDeps): ProjectsService {
  const { store, blobs, codec, clock, ids } = d;

  const load = async (id: string): Promise<Project> => {
    const p = await store.get(id);
    if (!p) throw notFound();
    return p;
  };
  const save = (p: Project) => store.put({ ...p, updatedAt: clock.now() });
  const cut = (name: string) => name.trim().slice(0, MAX_NAME).trim();

  // A blob a Run's capture points at is kept until the Project is deleted (SPEC-PROJ-04).
  const release = async (projectId: string, captureId: string | undefined, blobId: string) => {
    if (captureId && (await store.listRuns(projectId)).some((r) => r.captureIds.includes(captureId))) return;
    await blobs.remove(blobId);
  };

  const ingest = async (file: Blob, cssWidth: number) => {
    const out = await codec.normalise(file, cssWidth);
    const blobId = await blobs.put(out.blob);
    return { blobId, ...out.ref };
  };

  const warningsFor = (p: Project, viewport: ViewportId, cssWidth: number, dom?: DomSnapshot): Capture['warnings'] => {
    const w: Capture['warnings'] = [];
    const design = p.designs.find((x) => x.viewport === viewport);
    const pct = design ? (Math.abs(cssWidth - design.image.cssWidth) / design.image.cssWidth) * 100 : 0;
    if (pct > DEFAULT_RUNTIME_VALUES.width_mismatch_pct) w.push('width-mismatch');
    if (dom && Math.abs(dom.viewport.width - VIEWPORT_PRESETS[viewport]) > 1) w.push('dom-viewport-mismatch');
    return w;
  };

  // Saves the Project; if that fails the blob just written is removed so nothing is orphaned.
  const persist = async (p: Project, newBlobId: string) => {
    try {
      await save(p);
    } catch (e) {
      await blobs.remove(newBlobId).catch(() => undefined);
      throw e;
    }
  };

  return {
    async list() {
      const out: ProjectSummary[] = [];
      for (const p of await store.list()) {
        const latest = (await store.listRuns(p.id))[0];
        const count = (s: string) => latest?.results.filter((r) => r.status === s).length ?? 0;
        out.push({
          id: p.id,
          name: p.name,
          viewports: [...new Set([...p.designs, ...p.captures].map((x) => x.viewport))],
          lastRun: latest && {
            at: latest.createdAt,
            pass: count('pass'),
            fail: count('fail'),
            review: count('needs-review'),
          },
          isSample: p.isSample,
        });
      }
      return out;
    },

    async create(name) {
      let title = cut(name);
      if (!title) {
        const taken = new Set((await store.list()).map((p) => p.name));
        let n = taken.size + 1;
        while (taken.has(`Untitled page ${n}`)) n++;
        title = `Untitled page ${n}`;
      }
      const now = clock.now();
      const p: Project = {
        id: ids.next(),
        name: title,
        createdAt: now,
        updatedAt: now,
        isSample: false,
        designs: [],
        captures: [],
        cloudUsage: { requests: 0, bytes: 0 },
      };
      await store.put(p);
      return p;
    },

    get: (id) => store.get(id),

    async remove(id) {
      const p = await store.get(id);
      await store.remove(id);
      if (p) for (const b of [...p.designs, ...p.captures]) await blobs.remove(b.image.blobId);
    },

    async rename(id, name) {
      const p = await load(id);
      const title = cut(name);
      if (title) await save({ ...p, name: title });
    },

    async addDesign(projectId, file, viewport) {
      const p = await load(projectId);
      const image = await ingest(file, VIEWPORT_PRESETS[viewport]);
      const design: DesignRef = { id: ids.next(), viewport, image, addedAt: clock.now() };
      const old = p.designs.find((x) => x.viewport === viewport);
      await persist({ ...p, designs: [...p.designs.filter((x) => x !== old), design] }, image.blobId);
      if (old) await blobs.remove(old.image.blobId);
      return design;
    },

    async addCapture(projectId, file, viewport, dom) {
      const p = await load(projectId);
      const cssWidth = dom?.viewport.width ?? VIEWPORT_PRESETS[viewport];
      const image = await ingest(file, cssWidth);
      const capture: Capture = {
        id: ids.next(),
        viewport,
        image,
        ...(dom && { dom }),
        addedAt: clock.now(),
        warnings: warningsFor(p, viewport, cssWidth, dom),
      };
      const old = p.captures.find((x) => x.viewport === viewport);
      await persist({ ...p, captures: [...p.captures.filter((x) => x !== old), capture] }, image.blobId);
      if (old) await release(projectId, old.id, old.image.blobId);
      return capture;
    },

    async attachSnapshot(projectId, captureId, dom) {
      const p = await load(projectId);
      const old = p.captures.find((c) => c.id === captureId);
      if (!old) throw new CuiError('STORAGE_FAILED', 'Capture not found');
      const cssWidth = dom.viewport.width;
      let image = old.image;
      if (cssWidth !== old.image.cssWidth) {
        const src = await blobs.get(old.image.blobId);
        if (!src) throw new CuiError('STORAGE_FAILED', 'Capture image is missing');
        image = await ingest(src, cssWidth);
      }
      const next: Capture = { ...old, image, dom, warnings: warningsFor(p, old.viewport, cssWidth, dom) };
      await persist({ ...p, captures: p.captures.map((c) => (c.id === captureId ? next : c)) }, image.blobId);
      if (image !== old.image) await release(projectId, captureId, old.image.blobId);
      return next;
    },

    async suggestViewport(file) {
      return suggestViewport((await codec.probe(file)).width);
    },

    async grantCloudConsent(projectId, token) {
      const p = await load(projectId);
      const t = token as ConsentToken | undefined;
      if (!t || !Object.isFrozen(t) || t.__brand !== 'consent' || t.scope !== 'project' || t.projectId !== projectId) {
        throw new CuiError('CONSENT_REQUIRED', 'Cloud use needs your consent for this project');
      }
      await save({ ...p, cloudConsent: { grantedAt: clock.now() } });
    },

    async revokeCloudConsent(projectId) {
      const { cloudConsent: _revoked, ...rest } = await load(projectId);
      await save(rest);
    },

    async recordCloudUsage(projectId, bytes) {
      const p = await load(projectId);
      const add = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
      await save({ ...p, cloudUsage: { requests: p.cloudUsage.requests + 1, bytes: p.cloudUsage.bytes + add } });
    },
  };
}
