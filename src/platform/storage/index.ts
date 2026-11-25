import type { BlobStore, ProjectStore, SettingsStore } from '@kernel';

// Public API of platform/storage (SPEC §4.6.1). Bodies: lane A (task 6.x).

export function openStorage(): Promise<{ projects: ProjectStore; blobs: BlobStore; settings: SettingsStore }> {
  throw new Error('not implemented');
}
