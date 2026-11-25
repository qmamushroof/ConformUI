import { z } from 'zod';

// AI task output schemas (SPEC §4.3.4). Kept free of type imports so `types.ts` can infer from them without a cycle.
// The remaining task outputs (extract-contract, infer-responsive) join them in schemas.ts (task 3.4).

export const JudgeOutputSchema = z.object({
  verdict: z.enum(['pass', 'fail', 'uncertain']),
  confidence: z.enum(['high', 'medium', 'low']),
  explanation: z.string().max(300),
  suggestedFix: z.string().max(200),
});

export const DeepOutputSchema = z.object({
  items: z.array(
    z.object({
      findingId: z.string(),
      status: z.enum(['fail', 'pass', 'needs-review']),
      confidence: z.enum(['high', 'medium', 'low']),
      explanation: z.string(),
      suggestedFix: z.string(),
      crossViewportCause: z.string().optional(),
    }),
  ),
});
