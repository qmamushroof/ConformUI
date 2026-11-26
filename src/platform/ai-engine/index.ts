import type { FirebaseApp } from '@fb';
import type { AiEngine, AiTask, Clock, RuntimeConfig } from '@kernel';
import type { Schema } from 'firebase/ai';
import { createModelFactory } from './model-factory';
import { createRunner } from './run';
import { schemaForTask } from './schema-for';
import { createDeviceService } from './status';

// Public API of platform/ai-engine (SPEC §4.3.1). Bodies: lane A (task 5.x).

export function createAiEngine(d: { app: FirebaseApp; config: RuntimeConfig; clock: Clock }): AiEngine {
  // SPEC-AI-03: one factory, so the model built for the download is the one prompts reuse.
  const factory = createModelFactory({ app: d.app, config: d.config });
  const device = createDeviceService({ config: d.config, clock: d.clock, factory });
  const runner = createRunner({ ...d, factory, status: device.status });
  return {
    status: device.status,
    downloadDeviceModel: device.download,
    run: runner.run,
  };
}

export function schemaFor(task: AiTask): { cloud: Schema; device: object /*JSON Schema*/ } {
  return schemaForTask(task);
}
