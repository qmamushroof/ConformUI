import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_RUNTIME_VALUES,
  type RuntimeValues,
  RuntimeValuesSchema,
  type Thresholds,
  ThresholdsSchema,
} from '@kernel';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../architecture/helpers';

// SPEC §4.1.6 / S26: clamps are validity ranges. Out-of-range remote values are ignored key by key (SPEC-FB-07),
// so the schema rejects them and the default is kept by the caller.

const CLAMPS: Record<string, [number, number]> = {
  deep_daily_cap: [0, 100],
  on_device_timeout_s: [30, 600],
  size_tolerance_pct: [2, 30],
  major_deviation_pct: [10, 80],
  spacing_tolerance_pct: [5, 50],
  pixel_threshold: [0.01, 0.5],
  visual_diff_ratio: [0.02, 0.8],
  presence_ink_ratio: [0.005, 0.2],
  colour_delta_e: [0.02, 0.3],
  snap_min_iou: [0.1, 0.9],
  search_window_px: [0, 600],
  width_mismatch_pct: [0.5, 10],
};

const THRESHOLD_KEYS = [
  'size_tolerance_pct',
  'major_deviation_pct',
  'spacing_tolerance_pct',
  'pixel_threshold',
  'visual_diff_ratio',
  'presence_ink_ratio',
  'colour_delta_e',
  'snap_min_iou',
  'search_window_px',
  'width_mismatch_pct',
] as const satisfies readonly (keyof RuntimeValues)[];

describe('SPEC-KERNEL-03, SPEC §4.1.6: RuntimeValuesSchema clamps', () => {
  it('SPEC §4.1.6: the defaults parse and satisfy their own clamps', () => {
    expect(RuntimeValuesSchema.parse(DEFAULT_RUNTIME_VALUES)).toEqual(DEFAULT_RUNTIME_VALUES);
  });

  for (const [key, [min, max]] of Object.entries(CLAMPS)) {
    it(`SPEC §4.1.6: ${key} accepts ${min} and ${max} and rejects values just outside`, () => {
      const shape = RuntimeValuesSchema.shape as Record<string, { safeParse(v: unknown): { success: boolean } }>;
      const field = shape[key];
      expect(field?.safeParse(min).success, 'min').toBe(true);
      expect(field?.safeParse(max).success, 'max').toBe(true);
      expect(field?.safeParse(min - Math.max(min * 0.01, 0.001)).success, 'below').toBe(false);
      expect(field?.safeParse(max + Math.max(max * 0.01, 0.001)).success, 'above').toBe(false);
      expect(field?.safeParse('abc').success, 'string').toBe(false);
    });

    it(`SPEC §4.1.6: ${key} default lies inside its clamp`, () => {
      const v = DEFAULT_RUNTIME_VALUES[key as keyof RuntimeValues] as number;
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
    });
  }

  it('SPEC §4.1.6: the string and boolean keys carry the table defaults', () => {
    expect(DEFAULT_RUNTIME_VALUES).toMatchObject({
      cloud_first_pass_model: 'gemini-3.5-flash-lite',
      deep_model: 'gemini-3.8-flash',
      prompt_version: '1',
      cloud_enabled: true,
      feature_ai_infer_responsive: false,
    });
    expect(RuntimeValuesSchema.safeParse({ ...DEFAULT_RUNTIME_VALUES, cloud_enabled: 'yes' }).success).toBe(false);
    expect(RuntimeValuesSchema.safeParse({ ...DEFAULT_RUNTIME_VALUES, deep_model: 5 }).success).toBe(false);
  });

  it('SPEC §4.1.6: the schema has exactly the 17 table keys', () => {
    expect(Object.keys(RuntimeValuesSchema.shape).sort()).toEqual(Object.keys(DEFAULT_RUNTIME_VALUES).sort());
    expect(Object.keys(DEFAULT_RUNTIME_VALUES)).toHaveLength(17);
  });
});

describe('SPEC §4.1.6, S14: Thresholds', () => {
  it('S14: ThresholdsSchema holds exactly the ten threshold keys', () => {
    expect(Object.keys(ThresholdsSchema.shape).sort()).toEqual([...THRESHOLD_KEYS].sort());
  });

  it('S14: a Thresholds value picked from the defaults parses; an out-of-range one does not', () => {
    const t: Thresholds = Object.fromEntries(THRESHOLD_KEYS.map((k) => [k, DEFAULT_RUNTIME_VALUES[k]])) as Thresholds;
    expect(ThresholdsSchema.safeParse(t).success).toBe(true);
    expect(ThresholdsSchema.safeParse({ ...t, snap_min_iou: 0.95 }).success).toBe(false);
  });
});

describe('SPEC-FB-08, SPEC §4.1.6: remoteconfig.template.json parity', () => {
  it('SPEC-FB-08: template keys, types and defaults equal DEFAULT_RUNTIME_VALUES', () => {
    const tpl = JSON.parse(readFileSync(join(ROOT, 'remoteconfig.template.json'), 'utf8')) as {
      parameters: Record<string, { defaultValue: { value: string }; valueType: string }>;
    };
    expect(Object.keys(tpl.parameters).sort()).toEqual(Object.keys(DEFAULT_RUNTIME_VALUES).sort());
    for (const [key, def] of Object.entries(DEFAULT_RUNTIME_VALUES)) {
      const p = tpl.parameters[key];
      const type = typeof def === 'number' ? 'NUMBER' : typeof def === 'boolean' ? 'BOOLEAN' : 'STRING';
      expect(p?.valueType, key).toBe(type);
      expect(p?.defaultValue.value, key).toBe(String(def));
    }
  });
});
