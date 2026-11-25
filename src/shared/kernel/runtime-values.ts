import { z } from 'zod';

// SPEC §4.1.6 (S26). Keys, defaults and clamps as in the table. `@fb` only implements the RuntimeConfig port from these.

export const RuntimeValuesSchema = z.object({
  cloud_first_pass_model: z.string(),
  deep_model: z.string(),
  prompt_version: z.string(),
  cloud_enabled: z.boolean(),
  deep_daily_cap: z.number().min(0).max(100),
  feature_ai_infer_responsive: z.boolean(),
  size_tolerance_pct: z.number().min(2).max(30),
  major_deviation_pct: z.number().min(10).max(80),
  spacing_tolerance_pct: z.number().min(5).max(50),
  pixel_threshold: z.number().min(0.01).max(0.5),
  visual_diff_ratio: z.number().min(0.02).max(0.8),
  presence_ink_ratio: z.number().min(0.005).max(0.2),
  colour_delta_e: z.number().min(0.02).max(0.3),
  snap_min_iou: z.number().min(0.1).max(0.9),
  search_window_px: z.number().min(0).max(600),
  width_mismatch_pct: z.number().min(0.5).max(10),
});

export type RuntimeValues = z.infer<typeof RuntimeValuesSchema>;

/** Threshold keys only; snapshotted into each Run (PRD-P-10, S14). */
export const THRESHOLD_KEYS = [
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
] as const;

export const ThresholdsSchema = RuntimeValuesSchema.pick({
  size_tolerance_pct: true,
  major_deviation_pct: true,
  spacing_tolerance_pct: true,
  pixel_threshold: true,
  visual_diff_ratio: true,
  presence_ink_ratio: true,
  colour_delta_e: true,
  snap_min_iou: true,
  search_window_px: true,
  width_mismatch_pct: true,
});

export type Thresholds = z.infer<typeof ThresholdsSchema>;

export const DEFAULT_RUNTIME_VALUES: RuntimeValues = {
  cloud_first_pass_model: 'gemini-3.5-flash-lite',
  deep_model: 'gemini-3.8-flash',
  prompt_version: '1',
  cloud_enabled: true,
  deep_daily_cap: 10,
  feature_ai_infer_responsive: false,
  size_tolerance_pct: 8,
  major_deviation_pct: 25,
  spacing_tolerance_pct: 15,
  pixel_threshold: 0.1,
  visual_diff_ratio: 0.2,
  presence_ink_ratio: 0.03,
  colour_delta_e: 0.08,
  snap_min_iou: 0.3,
  search_window_px: 160,
  width_mismatch_pct: 2,
};
