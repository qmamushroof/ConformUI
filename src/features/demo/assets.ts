import { ContractSchema, DeepOutputSchema, DomSnapshotV1Schema, PrecomputedJudgedSchema } from '@kernel';
import type { SampleAssets } from './types';

// SPEC-DEMO-06: sample files are never imported statically; `?url` keeps them out of every chunk, `fetch` reads
// them on demand and the service worker precaches them.
const urls = import.meta.glob('./sample/**/*.{png,json}', { query: '?url', import: 'default' }) as Record<
  string,
  () => Promise<string>
>;

async function urlOf(name: string): Promise<string> {
  const load = urls[`./sample/${name}`];
  if (!load) throw new Error(`Sample file ${name} is not bundled`);
  return load();
}

async function response(name: string): Promise<Response> {
  const res = await fetch(await urlOf(name));
  if (!res.ok) throw new Error(`Could not load sample file ${name} (${res.status})`);
  return res;
}

async function png(name: string): Promise<Blob> {
  const blob = await (await response(name)).blob();
  return blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
}

async function parsed<T>(
  name: string,
  schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } },
): Promise<T> {
  const raw: unknown = await (await response(name)).json();
  const r = schema.safeParse(raw);
  if (!r.success) throw new Error(`Sample file ${name} is not valid`);
  return r.data;
}

async function set(prefix: 'flawed' | 'fixed', viewport: 'desktop' | 'mobile') {
  const [image, dom] = await Promise.all([
    png(`${prefix}-${viewport}.png`),
    parsed(`${prefix}-${viewport}.dom.json`, DomSnapshotV1Schema),
  ]);
  return { image, dom };
}

/** Lazy: `import.meta.glob(…, { query: '?url' })` + fetch (SPEC-DEMO-06). Rejects on the first bad file. */
export async function loadSampleAssets(): Promise<SampleAssets> {
  const [design, flawedD, flawedM, fixedD, fixedM, contract, flawed, fixed, deep, extraction] = await Promise.all([
    png('design-desktop.png'),
    set('flawed', 'desktop'),
    set('flawed', 'mobile'),
    set('fixed', 'desktop'),
    set('fixed', 'mobile'),
    parsed('contract.json', ContractSchema),
    parsed('precomputed/flawed.json', PrecomputedJudgedSchema.shape.flawed),
    parsed('precomputed/fixed.json', PrecomputedJudgedSchema.shape.flawed),
    parsed('precomputed/deep.json', DeepOutputSchema),
    parsed('precomputed/extraction.json', PrecomputedJudgedSchema.shape.extraction),
  ]);
  const precomputed = PrecomputedJudgedSchema.parse({ flawed, fixed, deep, extraction });
  return {
    design: { desktop: design },
    flawed: { desktop: flawedD, mobile: flawedM },
    fixed: { desktop: fixedD, mobile: fixedM },
    contract,
    precomputed,
  };
}
