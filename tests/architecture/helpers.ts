import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export interface ModuleRow {
  name: string;
  path: string;
  alias: string | null;
  mayImport: string[];
  npm: string[];
  ui: boolean;
  prompts: boolean;
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as T;
}

export const modules: ModuleRow[] = readJson<{ modules: ModuleRow[] }>('tests/architecture/modules.json').modules;

export function moduleByAlias(alias: string): ModuleRow {
  const m = modules.find((x) => x.alias === alias);
  if (!m) throw new Error(`unknown alias ${alias}`);
  return m;
}

/** tsconfig `references` entries of `dir` as sorted paths relative to the repo root. */
export function referencesOf(dir: string): string[] {
  const cfg = readJson<{ references?: { path: string }[] }>(`${dir}/tsconfig.json`);
  return (cfg.references ?? []).map((r) => relative(ROOT, resolve(ROOT, dir, r.path)).replaceAll('\\', '/')).sort();
}

/** Source text with comments removed (so prose mentioning `window` does not trip the purity grep). */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

/** SPEC-ARCH-06 (e): browser-global use in source text. Property accesses such as `dom.document.x` are fine. */
export function findBrowserGlobals(src: string): string[] {
  const code = stripComments(src);
  const hits: string[] = [];
  const checks: [string, RegExp][] = [
    ['window', /(?<![.\w$])window\b/],
    ['document', /(?<![.\w$])document\s*[.[]/],
    ['self.', /(?<![.\w$])self\s*\./],
    ['fetch(', /(?<![.\w$])fetch\s*\(/],
  ];
  for (const [label, re] of checks) if (re.test(code)) hits.push(label);
  return hits;
}
