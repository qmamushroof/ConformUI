import type { ImageCodec } from '@kernel';

// Public API of platform/imaging (SPEC §4.4.1). Bodies: lane A (task 6.x).

export function createImageCodec(): ImageCodec {
  throw new Error('not implemented');
}
