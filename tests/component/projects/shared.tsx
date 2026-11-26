import type { Capture, DesignRef, ImageRef, Project, ViewportId } from '@kernel';
import type { ProjectSummary, ProjectsService } from '@projects';
import { vi } from 'vitest';

export const image = (cssWidth: number, o: Partial<ImageRef> = {}): ImageRef => ({
  blobId: `b-${cssWidth}`,
  mime: 'image/png',
  width: cssWidth,
  height: 1000,
  cssWidth,
  bytes: 312 * 1024,
  ...o,
});

export const design = (viewport: ViewportId, cssWidth = viewport === 'desktop' ? 1440 : 390): DesignRef => ({
  id: `d-${viewport}`,
  viewport,
  image: image(cssWidth),
  addedAt: 0,
});

export const capture = (viewport: ViewportId, o: Partial<Capture> = {}): Capture => ({
  id: `c-${viewport}`,
  viewport,
  image: image(viewport === 'desktop' ? 1440 : 390),
  addedAt: 0,
  warnings: [],
  ...o,
});

export const project = (o: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Sample landing page',
  createdAt: Date.UTC(2026, 10, 25, 12),
  updatedAt: 0,
  isSample: false,
  designs: [],
  captures: [],
  cloudUsage: { requests: 0, bytes: 0 },
  ...o,
});

export const summary = (o: Partial<ProjectSummary> = {}): ProjectSummary => ({
  id: 'p1',
  name: 'Field ops pricing page',
  viewports: ['desktop'],
  createdAt: Date.UTC(2026, 10, 24, 12, 10),
  runCount: 3,
  hasContract: true,
  isSample: false,
  ...o,
});

export const png = (name = 'shot.png', type = 'image/png') => new File([new Uint8Array([1, 2, 3])], name, { type });

export function fakeService(o: { list?: ProjectSummary[] } = {}) {
  const s = {
    list: vi.fn(async () => o.list ?? []),
    create: vi.fn(async (name: string) => project({ id: 'new1', name })),
    remove: vi.fn(async (_id: string) => {}),
    rename: vi.fn(async (_id: string, _name: string) => {}),
    addDesign: vi.fn(async (_p: string, _f: Blob, viewport: ViewportId) => design(viewport)),
    addCapture: vi.fn(async (_p: string, _f: Blob, viewport: ViewportId) => capture(viewport)),
    attachSnapshot: vi.fn(async (_p: string, id: string) => capture('mobile', { id })),
    suggestViewport: vi.fn(async (_f: Blob): Promise<ViewportId> => 'mobile'),
  } satisfies Partial<ProjectsService>;
  return s;
}
