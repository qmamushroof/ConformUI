import { z } from 'zod';
import { CategorySchema, ConfidenceSchema } from './enums';

// AI task output schemas (SPEC §4.3.4, SPEC-KERNEL-03). They are the single source for model-output validation;
// `schemaFor(task)` in platform/ai-engine derives the Firebase and JSON Schemas from them. Kept free of imports
// from the other kernel files so `types.ts` can infer from them without a cycle.

/** Check kinds the model may propose when extracting a Contract (the contract feature maps them to CheckSpec, SPEC §4.7). */
export const EXTRACT_CHECK_KINDS = [
  'presence',
  'count',
  'text',
  'size',
  'position',
  'spacing',
  'dominant-text',
  'colour',
  'layout-fits',
  'region-diff',
  'judged',
] as const;

const box_2d = z.tuple([
  z.number().min(0).max(1000),
  z.number().min(0).max(1000),
  z.number().min(0).max(1000),
  z.number().min(0).max(1000),
]);

export const ExtractOutputSchema = z.object({
  requirements: z
    .array(
      z.object({
        category: CategorySchema,
        statement: z.string().max(160),
        condition: z.string().max(200),
        checkKind: z.enum(EXTRACT_CHECK_KINDS),
        box_2d, // 0..1000 of the given image, Gemma/Gemini order: [ymin, xmin, ymax, xmax]
        matchHint: z.object({ tag: z.string().optional(), role: z.string().optional(), text: z.string().optional() }),
        expectedText: z.string().optional(),
        expectedCount: z.number().optional(),
        primary: z.boolean().optional(),
      }),
    )
    .max(8),
});

export const InferOutputSchema = z.object({
  items: z
    .array(
      z.object({
        fromRequirementId: z.string(),
        checkKind: z.enum(['visible', 'presence', 'dominant-text']),
        statement: z.string().max(160),
        condition: z.string().max(200),
      }),
    )
    .max(6),
});

export const JudgeOutputSchema = z.object({
  verdict: z.enum(['pass', 'fail', 'uncertain']),
  confidence: ConfidenceSchema,
  explanation: z.string().max(300),
  suggestedFix: z.string().max(200),
});

export const DeepOutputSchema = z.object({
  items: z.array(
    z.object({
      findingId: z.string(),
      status: z.enum(['fail', 'pass', 'needs-review']),
      confidence: ConfidenceSchema,
      explanation: z.string(),
      suggestedFix: z.string(),
      crossViewportCause: z.string().optional(),
    }),
  ),
});

export type ExtractOutput = z.infer<typeof ExtractOutputSchema>;
export type InferOutput = z.infer<typeof InferOutputSchema>;
