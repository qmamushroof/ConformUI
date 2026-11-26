import type { FirebaseApp } from '@fb';
import type { AiEngine, AiTask, Clock, RuntimeConfig } from '@kernel';
import type { Schema } from 'firebase/ai';
import { schemaForTask } from './schema-for';

// Public API of platform/ai-engine (SPEC §4.3.1). Bodies: lane A (task 5.x).

export function createAiEngine(_d: { app: FirebaseApp; config: RuntimeConfig; clock: Clock }): AiEngine {
  throw new Error('not implemented');
}

export function schemaFor(task: AiTask): { cloud: Schema; device: object /*JSON Schema*/ } {
  return schemaForTask(task);
}
