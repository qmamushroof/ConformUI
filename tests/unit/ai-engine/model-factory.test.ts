import { CuiError, DEFAULT_RUNTIME_VALUES, type RuntimeValues } from '@kernel';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// SDK mock: records every getAI / getGenerativeModel call. Constants mirror the installed typings.
const sdk = vi.hoisted(() => ({ getAI: vi.fn(), getGenerativeModel: vi.fn() }));
vi.mock('firebase/ai', async (orig) => ({
  ...(await orig<typeof import('firebase/ai')>()),
  GoogleAIBackend: vi.fn(function (this: { kind: string }) {
    this.kind = 'google';
  }),
  InferenceMode: {
    PREFER_ON_DEVICE: 'prefer_on_device',
    ONLY_ON_DEVICE: 'only_on_device',
    ONLY_IN_CLOUD: 'only_in_cloud',
    PREFER_IN_CLOUD: 'prefer_in_cloud',
  },
  InferenceSource: { ON_DEVICE: 'on_device', IN_CLOUD: 'in_cloud' },
  getAI: sdk.getAI,
  getGenerativeModel: sdk.getGenerativeModel,
}));

import type { FirebaseApp } from '@fb';
import { bytesSentFor, createModelFactory, engineFromSource } from '../../../src/platform/ai-engine/model-factory';

const app = { name: 'app' } as FirebaseApp;
const SYSTEM = 'You are a checker.';
let values: RuntimeValues;
const config = { get: () => values, refresh: async () => {} };

type Spec = Parameters<ReturnType<typeof createModelFactory>['get']>[0];
const spec = (over: Partial<Spec> = {}): Spec => ({
  mode: 'PREFER_ON_DEVICE',
  task: 'judge',
  system: SYSTEM,
  promptVersion: 'v1',
  hasImages: true,
  ...over,
});

beforeEach(() => {
  values = { ...DEFAULT_RUNTIME_VALUES, cloud_first_pass_model: 'first-model', deep_model: 'deep-model' };
  sdk.getAI.mockReset().mockReturnValue({ ai: true });
  sdk.getGenerativeModel.mockReset().mockImplementation(() => ({ id: Symbol('model') }));
});

// biome-ignore lint/suspicious/noExplicitAny: inspecting recorded SDK arguments
const lastParams = (): any => sdk.getGenerativeModel.mock.calls.at(-1)?.[1];

describe('SPEC-AI-01: model construction per AiMode', () => {
  it('SPEC-AI-01: getAI uses the Google backend on the given app, lazily and once', () => {
    const f = createModelFactory({ app, config });
    expect(sdk.getAI).not.toHaveBeenCalled();
    f.get(spec());
    f.get(spec({ task: 'extract-contract' }));
    expect(sdk.getAI).toHaveBeenCalledTimes(1);
    expect(sdk.getAI.mock.calls[0]?.[0]).toBe(app);
    expect(sdk.getAI.mock.calls[0]?.[1].backend.kind).toBe('google');
    expect(sdk.getGenerativeModel.mock.calls[0]?.[0]).toEqual({ ai: true });
  });

  it('SPEC-AI-01: ONLY_ON_DEVICE has on-device params only and never inCloudParams', () => {
    createModelFactory({ app, config }).get(spec({ mode: 'ONLY_ON_DEVICE' }));
    const p = lastParams();
    expect(p.mode).toBe('only_on_device');
    expect('inCloudParams' in p).toBe(false);
    expect(p.onDeviceParams.createOptions).toEqual({
      expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
      initialPrompts: [{ role: 'system', content: [{ type: 'text', value: SYSTEM }] }],
    });
    expect(p.onDeviceParams.promptOptions.responseConstraint.type).toBe('object');
  });

  it('SPEC-AI-01: no image input is declared when the request has no images', () => {
    createModelFactory({ app, config }).get(spec({ mode: 'ONLY_ON_DEVICE', hasImages: false }));
    expect(lastParams().onDeviceParams.createOptions.expectedInputs).toEqual([{ type: 'text', languages: ['en'] }]);
  });

  it('SPEC-AI-01: PREFER_ON_DEVICE has both param sets, system text in initialPrompts and systemInstruction', () => {
    createModelFactory({ app, config }).get(spec({ mode: 'PREFER_ON_DEVICE', task: 'extract-contract' }));
    const p = lastParams();
    expect(p.mode).toBe('prefer_on_device');
    expect(p.onDeviceParams.createOptions.initialPrompts[0].content[0].value).toBe(SYSTEM);
    expect(p.inCloudParams.model).toBe('first-model');
    expect(p.inCloudParams.systemInstruction).toBe(SYSTEM);
    expect(p.inCloudParams.generationConfig.responseMimeType).toBe('application/json');
    expect(p.inCloudParams.generationConfig.responseSchema).toBeDefined();
  });

  it('SPEC-AI-01: ONLY_IN_CLOUD has inCloudParams only; model is cloud_first_pass_model except deep_model for deep-analysis', () => {
    const f = createModelFactory({ app, config });
    f.get(spec({ mode: 'ONLY_IN_CLOUD', task: 'judge' }));
    let p = lastParams();
    expect(p.mode).toBe('only_in_cloud');
    expect('onDeviceParams' in p).toBe(false);
    expect(p.inCloudParams.model).toBe('first-model');
    expect(p.inCloudParams.systemInstruction).toBe(SYSTEM);
    f.get(spec({ mode: 'ONLY_IN_CLOUD', task: 'deep-analysis' }));
    p = lastParams();
    expect(p.inCloudParams.model).toBe('deep-model');
  });

  it('SPEC-AI-01: PREFER_ON_DEVICE always uses cloud_first_pass_model, even for deep-analysis (the table gives deep_model to ONLY_IN_CLOUD only)', () => {
    createModelFactory({ app, config }).get(spec({ mode: 'PREFER_ON_DEVICE', task: 'deep-analysis' }));
    expect(lastParams().inCloudParams.model).toBe('first-model');
  });

  it('SPEC-AI-01: the schemas passed come from schemaFor of the task', () => {
    createModelFactory({ app, config }).get(spec({ mode: 'PREFER_ON_DEVICE', task: 'judge' }));
    const p = lastParams();
    expect(p.onDeviceParams.promptOptions.responseConstraint.properties.verdict).toBeDefined();
    expect(JSON.stringify(p.inCloudParams.generationConfig.responseSchema)).toContain('verdict');
  });
});

describe('SPEC-AI-01: thinking level for Deep Analysis', () => {
  const thinking = () => lastParams().inCloudParams.generationConfig.thinkingConfig;

  it('Deep Analysis on a Gemini 3 model asks for LOW thinking so the answer fits the cloud wait', () => {
    values = { ...values, deep_model: 'gemini-3.8-flash' };
    createModelFactory({ app, config }).get(spec({ mode: 'ONLY_IN_CLOUD', task: 'deep-analysis' }));
    expect(thinking()).toEqual({ thinkingLevel: 'LOW' });
  });

  it('a model that is not Gemini 3 gets no thinking config (a level on 2.5 is an SDK error)', () => {
    values = { ...values, deep_model: 'gemini-2.5-flash' };
    createModelFactory({ app, config }).get(spec({ mode: 'ONLY_IN_CLOUD', task: 'deep-analysis' }));
    expect(thinking()).toBeUndefined();
    values = { ...values, deep_model: 'deep-model' };
    createModelFactory({ app, config }).get(spec({ mode: 'ONLY_IN_CLOUD', task: 'deep-analysis' }));
    expect(thinking()).toBeUndefined();
  });

  it('other tasks keep the model default', () => {
    values = { ...values, cloud_first_pass_model: 'gemini-3.5-flash-lite' };
    createModelFactory({ app, config }).get(spec({ mode: 'ONLY_IN_CLOUD', task: 'judge' }));
    expect(thinking()).toBeUndefined();
  });

  it('PREFER_ON_DEVICE for deep-analysis uses the first-pass model and leaves thinking alone', () => {
    values = { ...values, cloud_first_pass_model: 'gemini-3.5-flash-lite' };
    createModelFactory({ app, config }).get(spec({ mode: 'PREFER_ON_DEVICE', task: 'deep-analysis' }));
    expect(thinking()).toBeUndefined();
  });
});

describe('SPEC-AI-03: instance cache', () => {
  it('SPEC-AI-03: same (mode, task, model, promptVersion, hasImages) returns the cached instance', () => {
    const f = createModelFactory({ app, config });
    const a = f.get(spec());
    const b = f.get(spec());
    expect(b.model).toBe(a.model);
    expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['mode', { mode: 'ONLY_IN_CLOUD' as const }],
    ['task', { task: 'extract-contract' as const }],
    ['promptVersion', { promptVersion: 'v2' }],
    ['hasImages', { hasImages: false }],
  ])('SPEC-AI-03: a different %s builds a new instance', (_n, over) => {
    const f = createModelFactory({ app, config });
    f.get(spec());
    f.get(spec(over));
    expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(2);
  });

  it('SPEC-AI-03: a Remote Config model-name change rebuilds the cloud-capable instance', () => {
    const f = createModelFactory({ app, config });
    const a = f.get(spec({ mode: 'ONLY_IN_CLOUD' }));
    values = { ...values, cloud_first_pass_model: 'other-model' };
    const b = f.get(spec({ mode: 'ONLY_IN_CLOUD' }));
    expect(b.model).not.toBe(a.model);
    expect(b.modelName).toBe('other-model');
    expect(lastParams().inCloudParams.model).toBe('other-model');
  });

  it('SPEC-AI-03: ONLY_ON_DEVICE is unaffected by model-name changes', () => {
    const f = createModelFactory({ app, config });
    const a = f.get(spec({ mode: 'ONLY_ON_DEVICE' }));
    values = { ...values, cloud_first_pass_model: 'other-model', deep_model: 'x' };
    const b = f.get(spec({ mode: 'ONLY_ON_DEVICE' }));
    expect(b.model).toBe(a.model);
    expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(1);
  });
});

describe('SPEC-AI-04: engine label and bytesSent', () => {
  it('SPEC-AI-04: inferenceSource on_device maps to on-device', () => {
    expect(engineFromSource('on_device', 'PREFER_ON_DEVICE')).toBe('on-device');
    expect(engineFromSource('on_device', 'ONLY_ON_DEVICE')).toBe('on-device');
  });

  it('SPEC-AI-04: inferenceSource in_cloud maps to cloud', () => {
    expect(engineFromSource('in_cloud', 'PREFER_ON_DEVICE')).toBe('cloud');
    expect(engineFromSource('in_cloud', 'ONLY_IN_CLOUD')).toBe('cloud');
  });

  it('SPEC-AI-04: missing inferenceSource is cloud under ONLY_IN_CLOUD', () => {
    expect(engineFromSource(undefined, 'ONLY_IN_CLOUD')).toBe('cloud');
  });

  it.each(['ONLY_ON_DEVICE', 'PREFER_ON_DEVICE'] as const)(
    'SPEC-AI-04: missing inferenceSource under %s is AI_FAILED, never assumed',
    (m) => {
      expect(() => engineFromSource(undefined, m)).toThrow(CuiError);
      try {
        engineFromSource(undefined, m);
      } catch (e) {
        expect((e as CuiError).code).toBe('AI_FAILED');
      }
    },
  );

  it('SPEC-AI-04: an unknown inferenceSource value is treated as missing, not as cloud by default', () => {
    expect(() => engineFromSource('weird' as never, 'PREFER_ON_DEVICE')).toThrow(CuiError);
  });

  it('SPEC-AI-04: bytesSent is the UTF-8 length of JSON.stringify({system,user,images}) for cloud', () => {
    const payload = {
      system: 'é',
      user: '日本',
      images: [{ mime: 'image/png', base64: 'AAAA', bytes: 3, role: 'pair' }],
    };
    const expected = new TextEncoder().encode(JSON.stringify(payload)).length;
    expect(bytesSentFor('cloud', payload as never)).toBe(expected);
    expect(expected).toBeGreaterThan(JSON.stringify(payload).length);
  });

  it('SPEC-AI-04: bytesSent is 0 when on-device', () => {
    expect(bytesSentFor('on-device', { system: 'a', user: 'b', images: [] })).toBe(0);
  });
});
