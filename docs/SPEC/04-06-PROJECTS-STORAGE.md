# 4.6 projects + storage

**[◀ 4.5 dom-snippet](04-05-DOM-SNIPPET.md)** · [SPEC index](../SPEC.md) · **[4.7 contract ▶](04-07-CONTRACT.md)**

`src/features/projects` (Projects and inputs per viewport, kernel only) and `src/platform/storage` (IndexedDB adapter, `idb`). Realises PRD-F-01, PRD-F-02, PRD-D-07, PRD-P-11.

## 4.6.1 Public API

```ts
// features/projects
export interface ProjectsDeps { store: ProjectStore; blobs: BlobStore; codec: ImageCodec; clock: Clock; ids: Ids }
export interface ProjectsService {
  list(): Promise<ProjectSummary[]>;                          // PRD-F-01.2
  create(name: string): Promise<Project>; get(id: string): Promise<Project | undefined>;
  remove(id: string): Promise<void>;                          // cascade (PRD-F-01.1)
  rename(id: string, name: string): Promise<void>;            // [P1] PRD-F-01.3
  addDesign(projectId: string, file: Blob, viewport: ViewportId): Promise<DesignRef>;
  addCapture(projectId: string, file: Blob, viewport: ViewportId, dom?: DomSnapshot): Promise<Capture>;  // replaces same viewport
  attachSnapshot(projectId: string, captureId: string, dom: DomSnapshot): Promise<Capture>;
  suggestViewport(file: Blob): Promise<ViewportId>;          // SPEC-MEAS-04
  grantCloudConsent(projectId: string, token: ConsentToken): Promise<void>; revokeCloudConsent(projectId: string): Promise<void>;
  recordCloudUsage(projectId: string, bytes: number): Promise<void>;
}
export interface ProjectSummary { id: string; name: string; viewports: ViewportId[]; lastRun?: { at: number; pass: number; fail: number; review: number }; isSample: boolean }
export function createProjectsService(d: ProjectsDeps): ProjectsService;
export const ProjectsScreen, ProjectInputs, ImageDropZone: React.FC<…>;
// platform/storage
export function openStorage(): Promise<{ projects: ProjectStore; blobs: BlobStore; settings: SettingsStore }>;
```

## 4.6.2 Input rules

| ID | Rule |
|---|---|
| `SPEC-PROJ-01` | Inputs by file picker, drag-and-drop and clipboard paste (`paste` event on the drop zone and the Project page; first `image/*` item) (PRD-F-02.1). [P1] Android share target prefills "Add capture" (§4.13). |
| `SPEC-PROJ-02` | On add: validate + normalise via `ImageCodec` (§4.4.2), store the PNG in `BlobStore`, keep `ImageRef`. Errors name the format/limit (PRD-F-02.2); nothing is silently cut. Accepted formats and limits are printed under every drop zone. |
| `SPEC-PROJ-03` | Viewport assignment: suggested from width (`SPEC-MEAS-04`), user can change before saving (PRD-F-02.3). One design and one current capture per viewport; adding a second replaces the first (old blob deleted unless referenced by a Run). |
| `SPEC-PROJ-04` | Replacing a capture keeps the Contract and marks the latest Run's results for that viewport stale ("Captures changed: Re-verify"); other viewports unaffected (PRD-F-02.6). Runs keep `captureIds`, so their evidence stays viewable; capture blobs referenced by any Run are kept until the Project is deleted. |
| `SPEC-PROJ-05` | Capture CSS width = attached snapshot `viewport.width`, else the preset. Attaching a snapshot later re-normalises the stored capture if the width changes. Warnings `width-mismatch`/`dom-viewport-mismatch` are stored on the Capture and shown. |
| `SPEC-PROJ-06` | `create` default name "Untitled page n"; names ≤ 80 chars. `list` sorted by `updatedAt` desc; > `MAX_PROJECTS` shows a notice, never auto-deletes. |
| `SPEC-PROJ-07` | Cloud consent: `grantCloudConsent` stores `{ grantedAt }` only when given a token minted from a trusted click (`mintConsent`, §4.1.4); `revokeCloudConsent` clears it immediately (PRD-F-11.3). `cloudUsage` accumulates request count and bytes for the privacy counter (PRD-F-11.5). |

## 4.6.3 IndexedDB schema (`SPEC-STORE-01`)

| Item | Value |
|---|---|
| Database | `conformui`, version 1 |
| `projects` | `keyPath: 'id'`; index `byUpdatedAt` |
| `contracts` | `keyPath: 'id'`; index `byProject` |
| `runs` | `keyPath: 'id'`; indexes `byProject`, `byProjectCreatedAt` (`[projectId, createdAt]`) |
| `blobs` | `keyPath: 'id'`; value `{ id, blob: Blob }` |
| `settings` | out-of-line key `'main'`; value `Settings` |
| Migrations | `upgrade(db, oldVersion)` switch; new versions append cases. DB newer than code → read-only + "Update the app": reads work, every write rejects `STORAGE_FAILED`. |

| ID | Rule |
|---|---|
| `SPEC-STORE-02` | `remove(projectId)` deletes the project, its contracts, runs and every blob they reference in **one** readwrite transaction over all stores (PRD-F-01.1). `clearAll()` clears all stores except `settings.deepUsage` (cap not resettable, PRD-D-27). |
| `SPEC-STORE-03` | Every read is zod-validated; an invalid record is skipped and counted ("1 item could not be read"), never crashes a list. The count is a runtime-only `skippedCount()` on the returned `projects` store (not on the `ProjectStore` port). Writes are validated too (invalid → `STORAGE_FAILED`); invalid settings read as defaults. |
| `SPEC-STORE-04` | `openStorage()` failing to open the database (IndexedDB blocked, private mode, upgrade error) maps to `STORAGE_UNAVAILABLE` (§5.4; nothing is deleted). Other failures map to `STORAGE_FAILED`; a Run still renders in memory with a notice "Not saved". `navigator.storage.persist()` requested once after the first Project is created. |
| `SPEC-STORE-05` | Nothing in this module touches the network; storage holds user content only on this device (PRD-P-11). |

## 4.6.4 Acceptance tests

`fake-indexeddb`: round-trip each store; cascade delete leaves no orphan blobs (`SPEC-STORE-02`); corrupted record skipped (`SPEC-STORE-03`); `clearAll` keeps `deepUsage`; open failure (stubbed `indexedDB.open` error) → `CuiError` `STORAGE_UNAVAILABLE`, no store touched (`SPEC-STORE-04`); capture replace marks only that viewport stale (`SPEC-PROJ-04`); E2E: Project survives reload and offline reload (PRD-F-01.1); paste, drop and picker each add an image (`SPEC-PROJ-01`).
