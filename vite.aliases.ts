import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface ModuleRow {
  path: string;
  alias: string | null;
}

/** Vite/Vitest `resolve.alias` read from the single module table (SPEC-ARCH-10). */
export function moduleAliases(): Record<string, string> {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const table = JSON.parse(readFileSync(`${root}tests/architecture/modules.json`, 'utf8')) as { modules: ModuleRow[] };
  const aliases: Record<string, string> = {};
  for (const m of table.modules) {
    if (m.alias) aliases[m.alias] = `${root}${m.path}/index.ts`;
  }
  return aliases;
}
