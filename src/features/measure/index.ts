import type { MeasureApi, MeasureClient } from '@kernel';
import { align } from './align';
import { colourMeasurement, deltaE, dominantColour } from './colour';
import { inkRatio, presenceMissing, regionDiff } from './diff';
import { matchElements, overflowFacts, overlaps } from './dom';
import { gapBetween, geometryMeasurement, pct } from './geometry';
import { locateOnCapture } from './locate';
import { snapRegion } from './snap';

// Public API of features/measure (SPEC §4.4.1). Bodies: lane B (task 8.x).

export const measureApi: MeasureApi = {
  align,
  snapRegion,
  locateOnCapture,
  regionDiff,
  inkRatio,
  dominantColour,
  deltaE,
  matchElements,
  overflowFacts,
  overlaps,
  pct,
};

// Helpers for Run (SPEC-MEAS-10..12) that are not part of the MeasureApi port.
export { colourMeasurement, gapBetween, geometryMeasurement, presenceMissing };

/** Async wrapper over `measureApi`; used by `app` in release 1 (S22). */
export function inlineMeasureClient(): MeasureClient {
  const client: Record<string, (...a: unknown[]) => Promise<unknown>> = {};
  for (const key of Object.keys(measureApi) as (keyof MeasureApi)[]) {
    const fn = measureApi[key] as (...a: unknown[]) => unknown;
    client[key] = async (...a) => fn(...a);
  }
  return client as unknown as MeasureClient;
}
