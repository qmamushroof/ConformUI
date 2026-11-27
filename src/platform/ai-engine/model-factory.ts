import type { FirebaseApp } from '@fb';
import type { AiMode, AiRequest, AiTask, RuntimeConfig } from '@kernel';
import { CuiError } from '@kernel';
import {
  type AI,
  type GenerativeModel,
  GoogleAIBackend,
  getAI,
  getGenerativeModel,
  type HybridParams,
  InferenceMode,
  InferenceSource,
  ThinkingLevel,
} from 'firebase/ai';
import { schemaForTask } from './schema-for';

// SPEC-AI-01, SPEC-AI-03, SPEC-AI-04: model construction per AiMode, instance cache, engine label.

export interface ModelSpec {
  mode: AiMode;
  task: AiTask;
  system: string;
  promptVersion: string;
  hasImages: boolean;
}

export interface BuiltModel {
  model: GenerativeModel;
  /** Cloud model name; `on-device` for ONLY_ON_DEVICE (no cloud model is configured). */
  modelName: string;
}

export const ON_DEVICE_MODEL_NAME = 'on-device';

/** SPEC-AI-04. Anything other than the two SDK constants counts as missing. */
export function engineFromSource(source: string | undefined, mode: AiMode): 'on-device' | 'cloud' {
  if (source === InferenceSource.ON_DEVICE) return 'on-device';
  if (source === InferenceSource.IN_CLOUD) return 'cloud';
  if (mode === 'ONLY_IN_CLOUD') return 'cloud';
  throw new CuiError('AI_FAILED', 'The AI response did not say where it ran');
}

/** SPEC-AI-04: request payload bytes; nothing leaves the device when on-device. */
export function bytesSentFor(
  engine: 'on-device' | 'cloud',
  req: Pick<AiRequest, 'system' | 'user' | 'images'>,
): number {
  if (engine !== 'cloud') return 0;
  const { system, user, images } = req;
  return new TextEncoder().encode(JSON.stringify({ system, user, images })).length;
}

/**
 * Deep Analysis reads a long, image-heavy request on a Gemini 3 model, which thinks at a high level by default and
 * outlived the cloud wait. A low level keeps it well inside. Only Gemini 3 models take a level (2.5 takes a budget,
 * and a level on another model is an SDK error), so any other id keeps its default.
 */
function thinkingFor(spec: ModelSpec, modelName: string) {
  const cloudDeep = spec.mode === 'ONLY_IN_CLOUD' && spec.task === 'deep-analysis';
  return cloudDeep && /^gemini-3/.test(modelName) ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {};
}

export function createModelFactory(d: { app: FirebaseApp; config: RuntimeConfig }) {
  let ai: AI | undefined;
  const cache = new Map<string, BuiltModel>();

  function cloudModelName(mode: AiMode, task: AiTask): string {
    const v = d.config.get();
    return mode === 'ONLY_IN_CLOUD' && task === 'deep-analysis' ? v.deep_model : v.cloud_first_pass_model;
  }

  function build(spec: ModelSpec, modelName: string): GenerativeModel {
    const schemas = schemaForTask(spec.task);
    const onDeviceParams = {
      createOptions: {
        expectedInputs: [
          { type: 'text' as const, languages: ['en'] },
          ...(spec.hasImages ? [{ type: 'image' as const }] : []),
        ],
        expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
        initialPrompts: [{ role: 'system' as const, content: [{ type: 'text' as const, value: spec.system }] }],
      },
      promptOptions: { responseConstraint: schemas.device },
    };
    const inCloudParams = {
      model: modelName,
      systemInstruction: spec.system,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schemas.cloud,
        ...thinkingFor(spec, modelName),
      },
    };
    let params: HybridParams;
    if (spec.mode === 'ONLY_ON_DEVICE') {
      params = { mode: InferenceMode.ONLY_ON_DEVICE, onDeviceParams };
    } else if (spec.mode === 'PREFER_ON_DEVICE') {
      params = { mode: InferenceMode.PREFER_ON_DEVICE, onDeviceParams, inCloudParams };
    } else {
      params = { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams };
    }
    // SPEC-AI-01: after App Check (initFirebase), the Gemini Developer API backend.
    ai ??= getAI(d.app, { backend: new GoogleAIBackend() });
    return getGenerativeModel(ai, params);
  }

  return {
    get(spec: ModelSpec): BuiltModel {
      const modelName = spec.mode === 'ONLY_ON_DEVICE' ? ON_DEVICE_MODEL_NAME : cloudModelName(spec.mode, spec.task);
      const key = JSON.stringify([spec.mode, spec.task, modelName, spec.promptVersion, spec.hasImages]);
      const hit = cache.get(key);
      if (hit) return hit;
      const built = { model: build(spec, modelName), modelName };
      cache.set(key, built);
      return built;
    },
  };
}
