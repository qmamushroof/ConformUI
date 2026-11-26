import type { FirebaseApp } from '@fb';
import type { AiEngine, AiTask, Clock, RuntimeConfig } from '@kernel';
import type { Schema } from 'firebase/ai';
import { createRunner } from './run';
import { schemaForTask } from './schema-for';

// Public API of platform/ai-engine (SPEC §4.3.1). Bodies: lane A (task 5.x).

export function createAiEngine(d: { app: FirebaseApp; config: RuntimeConfig; clock: Clock }): AiEngine {
  // 5.5 replaces `status` and `downloadDeviceModel` and feeds the real status into the runner.
  const status = (): Promise<never> => Promise.reject(new Error('not implemented'));
  const runner = createRunner({ ...d, status });
  return {
    status,
    downloadDeviceModel: () => Promise.reject(new Error('not implemented')),
    run: runner.run,
  };
}

export function schemaFor(task: AiTask): { cloud: Schema; device: object /*JSON Schema*/ } {
  return schemaForTask(task);
}
