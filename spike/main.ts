import type { AiMode, AiTask, RuntimeConfig } from '@kernel';
import { DEFAULT_RUNTIME_VALUES, DeepOutputSchema, ExtractOutputSchema, InferOutputSchema, JudgeOutputSchema } from '@kernel';
import { initFirebase } from '@fb';
import { GoogleAIBackend, getAI, getGenerativeModel, InferenceMode, InferenceSource } from 'firebase/ai';
import { createModelFactory } from '../src/platform/ai-engine/model-factory';
import { schemaForTask } from '../src/platform/ai-engine/schema-for';

// THROWAWAY spike page. Never include secrets or the App Check debug token in results.
type Json = Record<string, unknown>;
const env = import.meta.env as unknown as Record<string, string | boolean | undefined>;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const logEl = $('log');

// ---- environment ------------------------------------------------------------------------------------------------
const brands = (navigator as unknown as { userAgentData?: { brands: { brand: string; version: string }[] } }).userAgentData?.brands;
const chromeVersion =
  brands?.find((b) => b.brand === 'Google Chrome')?.version ?? /Chrome\/([\d.]+)/.exec(navigator.userAgent)?.[1] ?? '?';
const mode = `${location.origin} DEV=${String(import.meta.env.DEV)}`;
$('env').textContent = `${mode} | Chrome ${chromeVersion} | LanguageModel ${typeof (globalThis as Json).LanguageModel}`;
const setOnline = () => {
  $('online').textContent = String(navigator.onLine);
};
setOnline();
addEventListener('online', setOnline);
addEventListener('offline', setOnline);

// ---- CSP violation + console capture ----------------------------------------------------------------------------
const violations: Json[] = [];
addEventListener('securitypolicyviolation', (ev) => {
  violations.push({
    directive: ev.effectiveDirective,
    blocked: ev.blockedURI,
    source: ev.sourceFile,
    line: ev.lineNumber,
    disposition: ev.disposition,
    t: new Date().toISOString(),
  });
});

function safe(x: unknown): string {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}
function errInfo(err: unknown): Json {
  const x = err as { name?: string; code?: string; message?: string; customErrorData?: { status?: number; statusText?: string } };
  return {
    name: x?.name,
    code: x?.code,
    message: String(x?.message ?? err).slice(0, 800),
    status: x?.customErrorData?.status,
    statusText: x?.customErrorData?.statusText,
  };
}

async function captured<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: Json; consoleLines: string[]; csp: Json[] }> {
  const lines: string[] = [];
  const orig = { warn: console.warn, error: console.error };
  const vStart = violations.length;
  const grab =
    (lvl: 'warn' | 'error') =>
    (...a: unknown[]) => {
      lines.push(
        `${lvl}: ${a.map((x) => (x instanceof Error ? x.message : typeof x === 'string' ? x : safe(x))).join(' ')}`.slice(0, 600),
      );
      orig[lvl](...a);
    };
  console.warn = grab('warn');
  console.error = grab('error');
  try {
    const value = await fn();
    await new Promise((r) => setTimeout(r, 50)); // let securitypolicyviolation events flush
    return { value, consoleLines: lines, csp: violations.slice(vStart) };
  } catch (err) {
    await new Promise((r) => setTimeout(r, 50));
    return { error: errInfo(err), consoleLines: lines, csp: violations.slice(vStart) };
  } finally {
    console.warn = orig.warn;
    console.error = orig.error;
  }
}

// ---- recording --------------------------------------------------------------------------------------------------
function show(text: string, bad = false): void {
  const d = document.createElement('div');
  d.className = bad ? 'bad' : 'ok';
  d.textContent = `${text}\n`;
  logEl.prepend(d);
}
async function record(check: string, inputs: Json, run: () => Promise<Json>): Promise<void> {
  const t0 = performance.now();
  show(`... ${check} running`);
  const r = await captured(run);
  const rec = {
    check,
    timestamp: new Date().toISOString(),
    server: mode,
    inputs,
    outputs: r.value ?? null,
    error: r.error ?? null,
    latencyMs: Math.round(performance.now() - t0),
    consoleWarnings: r.consoleLines,
    cspViolations: r.csp,
    online: navigator.onLine,
    userAgent: navigator.userAgent,
    chromeVersion,
  };
  try {
    await fetch('/__spike/record', { method: 'POST', body: JSON.stringify(rec), headers: { 'content-type': 'application/json' } });
  } catch (err) {
    show(`!! could not persist ${check}: ${String(err)}`, true);
  }
  show(`${rec.error ? 'FAIL' : 'done'} ${check} (${rec.latencyMs} ms)\n${JSON.stringify({ ...rec, userAgent: undefined }, null, 1)}`, !!rec.error);
}

// ---- firebase ---------------------------------------------------------------------------------------------------
const ev = (k: string) => String(env[k] ?? '');
let init: ReturnType<typeof initFirebase> | undefined;
let initError: unknown;
try {
  init = initFirebase({
    apiKey: ev('VITE_FIREBASE_API_KEY'),
    authDomain: ev('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: ev('VITE_FIREBASE_PROJECT_ID'),
    appId: ev('VITE_FIREBASE_APP_ID'),
    messagingSenderId: ev('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    recaptchaEnterpriseKey: ev('VITE_RECAPTCHA_ENTERPRISE_KEY'),
    appCheckDebug: ev('VITE_APPCHECK_DEBUG') === '1',
    appCheckDebugToken: ev('VITE_APPCHECK_DEBUG_TOKEN') || undefined,
  });
} catch (err) {
  initError = err;
  show(`initFirebase threw: ${safe(errInfo(err))}`, true);
}
const config: RuntimeConfig = { get: () => DEFAULT_RUNTIME_VALUES, refresh: async () => {} };
const factory = init ? createModelFactory({ app: init.app, config }) : undefined;
function needFactory() {
  if (!factory) throw new Error(`Firebase not initialised: ${safe(errInfo(initError))}`);
  return factory;
}
function needApp() {
  if (!init) throw new Error(`Firebase not initialised: ${safe(errInfo(initError))}`);
  return init.app;
}
show(
  `ready. firebase init ${init ? 'ok' : 'FAILED'}; App Check debug flag ${ev('VITE_APPCHECK_DEBUG') === '1' ? 'on' : 'off'} (DEV=${String(import.meta.env.DEV)})`,
  !init,
);

// ---- images (canvas, no assets) ---------------------------------------------------------------------------------
async function jpegB64(w: number, h: number, label: string, hue: number): Promise<string> {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.fillStyle = `hsl(${hue} 70% 45%)`;
  g.fillRect(0, 0, w, 90);
  g.fillStyle = '#fff';
  g.font = 'bold 40px sans-serif';
  g.fillText(`${label} Header`, 30, 60);
  g.fillStyle = '#222';
  g.font = '28px sans-serif';
  g.fillText('Welcome back. Start a new project.', 30, 160);
  g.fillStyle = `hsl(${(hue + 120) % 360} 70% 40%)`;
  g.fillRect(30, 200, 220, 56);
  g.fillStyle = '#fff';
  g.fillText('Get started', 55, 238);
  g.strokeStyle = '#888';
  g.strokeRect(300, 200, w - 330, h - 230);
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b as Blob), 'image/jpeg', 0.85));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
const imgPart = (data: string) => ({ inlineData: { mimeType: 'image/jpeg', data } });

// ---- shared on-device runner ------------------------------------------------------------------------------------
async function runOnDevice(task: AiTask, hasImages: boolean, parts: unknown[], m: AiMode = 'ONLY_ON_DEVICE') {
  const built = needFactory().get({
    mode: m,
    task,
    system: 'You are a UI acceptance checker. Reply with JSON only.',
    promptVersion: '1',
    hasImages,
  });
  const progress: number[] = [];
  const model = built.model as unknown as {
    initializeDeviceModel?: (cb?: (p: number) => void) => Promise<void>;
    generateContent: (p: unknown) => Promise<{ response: { text(): string; inferenceSource?: string } }>;
  };
  let initMs: number | undefined;
  if (model.initializeDeviceModel) {
    const t = performance.now();
    await model.initializeDeviceModel((p) => progress.push(Math.round(p * 100)));
    initMs = Math.round(performance.now() - t);
  }
  const t1 = performance.now();
  const res = await model.generateContent(parts);
  const text = res.response.text();
  return {
    text: text.slice(0, 3000),
    source: res.response.inferenceSource,
    onDeviceConstant: InferenceSource.ON_DEVICE,
    initMs,
    promptMs: Math.round(performance.now() - t1),
    downloadProgressSeen: progress.slice(-3),
  };
}
const SCHEMA_OF = {
  'extract-contract': ExtractOutputSchema,
  'infer-responsive': InferOutputSchema,
  judge: JudgeOutputSchema,
  'deep-analysis': DeepOutputSchema,
} as const;
function parseWith(task: AiTask, text: string): Json {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { jsonParses: false, zodOk: false, parseError: String(err).slice(0, 200) };
  }
  const z = SCHEMA_OF[task].safeParse(json);
  return {
    jsonParses: true,
    zodOk: z.success,
    zodIssues: z.success ? undefined : z.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`),
  };
}

// ---- checks -----------------------------------------------------------------------------------------------------
const LM = () => (globalThis as unknown as { LanguageModel?: { availability(o?: unknown): Promise<string> } }).LanguageModel;
async function avail(opts?: unknown): Promise<Json> {
  const lm = LM();
  if (!lm) return { thrown: 'LanguageModel undefined' };
  try {
    return { value: await lm.availability(opts) };
  } catch (err) {
    return { thrown: errInfo(err) };
  }
}
const TEXT_OPTS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
const IMG_OPTS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};
const JUDGE_PROMPT = 'Does the image contain a button labelled "Get started"? Answer with the verdict JSON.';

const checks: Record<string, () => Promise<void>> = {
  'a1-availability': () =>
    record(
      'A1 availability',
      { flagNote: 'owner: note whether chrome://flags/#prompt-api-multimodal-input is Enabled / Disabled / Default' },
      async () => ({
        imageOnly: await avail({ expectedInputs: [{ type: 'image' }] }),
        imageWithText: await avail(IMG_OPTS),
        textOnly: await avail(TEXT_OPTS),
        bareCall: await avail(),
      }),
    ),
  'a1-image-prompt': () =>
    record('A1 ONLY_ON_DEVICE image prompt', { image: '1024x384 JPEG', task: 'judge' }, async () => {
      const img = await jpegB64(1024, 384, 'A', 210);
      const r = await runOnDevice('judge', true, [JUDGE_PROMPT, imgPart(img)]);
      return { ...r, ...parseWith('judge', r.text) };
    }),
  'a2-one-image': () =>
    record('A2 one 1024px JPEG band', { image: '1024x512 JPEG q0.85' }, async () => {
      const img = await jpegB64(1024, 512, 'A', 210);
      const r = await runOnDevice('judge', true, [JUDGE_PROMPT, imgPart(img)]);
      return { imageBase64Chars: img.length, ...r, ...parseWith('judge', r.text) };
    }),
  'a2-two-images': () =>
    record('A2 two images in one prompt', { images: 2, each: '1024x512 JPEG' }, async () => {
      const a = await jpegB64(1024, 512, 'Design', 210);
      const b = await jpegB64(1024, 512, 'Impl', 20);
      const r = await runOnDevice('judge', true, [
        'Compare the two images (first is design, second is implementation). Give the verdict JSON.',
        imgPart(a),
        imgPart(b),
      ]);
      return { ...r, ...parseWith('judge', r.text) };
    }),
  'a6-schemas': async () => {
    const img = await jpegB64(1024, 512, 'A', 210);
    const cases: [AiTask, boolean, unknown[]][] = [
      ['extract-contract', true, ['List up to 3 requirements visible in this design.', imgPart(img)]],
      ['infer-responsive', false, ['Given requirement r1 "Header is visible" (visible), propose responsive items. fromRequirementId must be "r1".']],
      ['judge', false, ['A button labelled "Get started" is present in the DOM snapshot. Does it satisfy "Primary button says Get started"?']],
      ['deep-analysis', false, ['Finding f1 failed: header height 60px expected 90px. Analyse it. findingId must be "f1".']],
    ];
    for (const [task, hasImages, parts] of cases) {
      await record(
        `A6 schema ${task}`,
        { task, hasImages, responseConstraint: 'schemaFor(task).device', deviceSchemaChars: JSON.stringify(schemaForTask(task).device).length },
        async () => {
          const r = await runOnDevice(task, hasImages, parts);
          return { accepted: true, ...r, ...parseWith(task, r.text) };
        },
      );
    }
  },
  'a4-cloud-models': async () => {
    for (const key of ['cloud_first_pass_model', 'deep_model'] as const) {
      const name = DEFAULT_RUNTIME_VALUES[key];
      await record(`A4 ONLY_IN_CLOUD ${key}`, { key, model: name }, async () => {
        const ai = getAI(needApp(), { backend: new GoogleAIBackend() });
        const m = getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams: { model: name } });
        const res = await m.generateContent('Reply with the single word: pong');
        return { ok: true, text: res.response.text().slice(0, 100), source: res.response.inferenceSource, cloudConstant: InferenceSource.IN_CLOUD };
      });
    }
  },
  'o1-offline-image-prompt': () =>
    record(
      'O1 offline ONLY_ON_DEVICE image prompt',
      { variant: ($('o1-variant') as HTMLSelectElement).value, navigatorOnLine: navigator.onLine },
      async () => {
        const img = await jpegB64(1024, 384, 'A', 210);
        const r = await runOnDevice('judge', true, [JUDGE_PROMPT, imgPart(img)]);
        return { ...r, ...parseWith('judge', r.text) };
      },
    ),
  'd1-csp-report': () =>
    record('D1 CSP violations so far', {}, async () => ({ totalViolations: violations.length, violations: violations.slice(0, 50) })),
  'd1-cloud-call': () =>
    record(
      'D1 cloud call under CSP',
      { model: DEFAULT_RUNTIME_VALUES.cloud_first_pass_model, note: 'preview build forces DEV=true so the debug provider can run' },
      async () => {
        const ai = getAI(needApp(), { backend: new GoogleAIBackend() });
        const m = getGenerativeModel(ai, {
          mode: InferenceMode.ONLY_IN_CLOUD,
          inCloudParams: { model: DEFAULT_RUNTIME_VALUES.cloud_first_pass_model },
        });
        const res = await m.generateContent('Reply with the single word: pong');
        return { ok: true, text: res.response.text().slice(0, 100) };
      },
    ),
};

for (const b of document.querySelectorAll<HTMLButtonElement>('button[data-check]')) {
  b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      await checks[b.dataset.check as string]?.();
    } finally {
      b.disabled = false;
    }
  });
}
$('a3-save').addEventListener('click', () =>
  record('A3 model identity (chrome://on-device-internals)', { note: 'pasted by owner' }, async () => ({
    pasted: ($('a3-text') as HTMLTextAreaElement).value.slice(0, 6000),
  })),
);
$('run-all').addEventListener('click', async () => {
  for (const k of ['a1-availability', 'a1-image-prompt', 'a2-one-image', 'a2-two-images', 'a6-schemas', 'a4-cloud-models', 'd1-cloud-call', 'd1-csp-report']) {
    await checks[k]?.();
  }
});
