import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type AiTask,
  DeepOutputSchema,
  ExtractOutputSchema,
  guardNumbers,
  InferOutputSchema,
  JudgeOutputSchema,
} from '@kernel';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { ROOT } from '../../architecture/helpers';

// SPEC §7.3: tests/fixtures/ai/<task>-{valid,malformed,invented-numbers}.json.
// Used by SPEC-AI-06 (malformed), SPEC-KERNEL-08 (invented numbers), PRD-M-05, PRD-M-03.

const SCHEMAS: Record<AiTask, z.ZodType> = {
  'extract-contract': ExtractOutputSchema,
  'infer-responsive': InferOutputSchema,
  judge: JudgeOutputSchema,
  'deep-analysis': DeepOutputSchema,
};

// Numbers the valid fixtures may legitimately mention (the allowedNumbers a caller would pass).
const ALLOWED = [1, 2, 3, 8, 220, 390];
const TEXT_KEYS = new Set(['statement', 'condition', 'explanation', 'suggestedFix', 'crossViewportCause']);

const load = (task: AiTask, kind: string): unknown =>
  JSON.parse(readFileSync(join(ROOT, `tests/fixtures/ai/${task}-${kind}.json`), 'utf8'));

function modelText(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) for (const x of v) modelText(x, out);
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (typeof x === 'string' && TEXT_KEYS.has(k)) out.push(x);
      else modelText(x, out);
    }
  }
  return out;
}

describe('SPEC §7.3, SPEC-KERNEL-03: AI fixtures per task', () => {
  for (const task of Object.keys(SCHEMAS) as AiTask[]) {
    const schema = SCHEMAS[task];

    it(`SPEC-KERNEL-03, SPEC-AI-06: ${task}-valid.json passes the kernel schema`, () => {
      expect(schema.safeParse(load(task, 'valid')).success).toBe(true);
    });

    it(`SPEC-AI-06, PRD-M-05: ${task}-malformed.json fails the kernel schema`, () => {
      expect(schema.safeParse(load(task, 'malformed')).success).toBe(false);
    });

    it(`SPEC-KERNEL-08, PRD-M-03: ${task}-valid.json text mentions no number outside the allowed list`, () => {
      for (const text of modelText(load(task, 'valid'))) expect(guardNumbers(text, ALLOWED), text).toBe(true);
    });

    it(`SPEC-KERNEL-08, PRD-M-03: ${task}-invented-numbers.json is schema-valid but trips the number guard`, () => {
      const json = load(task, 'invented-numbers');
      expect(schema.safeParse(json).success).toBe(true);
      const texts = modelText(json);
      expect(texts.length).toBeGreaterThan(0);
      expect(texts.some((t) => !guardNumbers(t, ALLOWED))).toBe(true);
    });
  }
});
