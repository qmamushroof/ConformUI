import type { Capture, ConsentToken, DesignRef, DomSnapshot, Project, ViewportId } from '@kernel';

export interface ProjectSummary {
  id: string;
  name: string;
  viewports: ViewportId[];
  createdAt?: number;
  runCount?: number;
  /** A contract exists (so Export contract is possible). */
  hasContract?: boolean;
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
