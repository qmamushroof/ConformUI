import type { FirebaseApp } from '@fb';
import type { AiEngine, AiTask, Clock, RuntimeConfig } from '@kernel';
import { DeepOutputSchema, ExtractOutputSchema, InferOutputSchema, JudgeOutputSchema } from '@kernel';
import type { Schema } from 'firebase/ai';
import { zodToSchemas } from './schema-for';

// Public API of platform/ai-engine (SPEC §4.3.1). Bodies: lane A (task 5.x).

export function createAiEngine(_d: { app: FirebaseApp; config: RuntimeConfig; clock: Clock }): AiEngine {
  throw new Error('not implemented');
}

const OUTPUT_SCHEMAS = {
  'extract-contract': ExtractOutputSchema,
  'infer-responsive': InferOutputSchema,
  judge: JudgeOutputSchema,
  'deep-analysis': DeepOutputSchema,
} as const;

export function schemaFor(task: AiTask): { cloud: Schema; device: object /*JSON Schema*/ } {
  const schema = OUTPUT_SCHEMAS[task];
  if (!schema) throw new Error(`schemaFor: unknown task ${String(task)}`);
  return zodToSchemas(schema);
}
