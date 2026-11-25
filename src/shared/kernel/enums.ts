import { z } from 'zod';

// Zod enums for the SPEC §4.1.1 vocabulary. No imports from other kernel files, so `ai-outputs.ts` and `schemas.ts`
// can both use them without a cycle; schemas.ts proves each equals its TypeScript union.

export const ViewportIdSchema = z.enum(['desktop', 'mobile', 'tablet']);
export const EngineSchema = z.enum(['on-device', 'cloud', 'measured']);
export const OriginSchema = z.enum(['ai', 'user', 'sample', 'precomputed', 'rule']);
export const CategorySchema = z.enum([
  'presence',
  'content',
  'position',
  'size',
  'spacing',
  'typography',
  'colour',
  'responsive',
]);
export const LabelSchema = z.enum(['explicit', 'inferred']);
export const CheckTypeSchema = z.enum(['measured', 'visual', 'judged']);
export const StatusSchema = z.enum(['pass', 'fail', 'needs-review', 'not-checked']);
export const NotCheckedReasonSchema = z.enum([
  'no-capture',
  'no-dom-snapshot',
  'offline',
  'consent-declined',
  'device-unavailable',
  'region-unresolved',
  'misaligned',
  'outside-capture',
  'ai-invalid-output',
  'ai-failed',
  'cloud-disabled',
  'mode-on-device-only',
  'no-inferred-items',
]);
export const SeveritySchema = z.enum(['critical', 'major', 'minor']);
export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export const ChangeSchema = z.enum(['resolved', 'remaining', 'new', 'regressed', 'still-passing']);
export const SourceTagSchema = z.enum(['dom-snapshot', 'design-image', 'capture-image', 'contract']);
export const AiModeSchema = z.enum(['ONLY_ON_DEVICE', 'PREFER_ON_DEVICE', 'ONLY_IN_CLOUD']);
export const AiTaskSchema = z.enum(['extract-contract', 'infer-responsive', 'judge', 'deep-analysis']);
