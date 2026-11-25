import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findBrowserGlobals, type ModuleRow, moduleByAlias, modules, ROOT, readJson, referencesOf } from './helpers';

const cjsRequire = createRequire(import.meta.url);
const DEPCRUISE_BIN = join(ROOT, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');
const CONFIG = join(ROOT, '.dependency-cruiser.cjs');

interface Violation {
  from: string;
  to: string;
  rule: { name: string; severity: string };
}

// SPEC-ARCH-06 (a): dependency-cruiser over a target, JSON result (the CLI is the supported entry of the same engine).
function depcruise(cwd: string, target: string): Violation[] {
  const r = spawnSync(process.execPath, [DEPCRUISE_BIN, target, '--config', CONFIG, '--output-type', 'json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const out = JSON.parse(r.stdout) as { summary: { violations: Violation[] } };
  return out.summary.violations;
}

function listFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listFiles(p, out);
    else out.push(p);
  }
  return out;
}

describe('SPEC-ARCH-05: .dependency-cruiser.cjs rule set', () => {
  const config = cjsRequire(CONFIG) as {
    forbidden: { name: string; severity: string; from: { path?: string | string[] } }[];
    options: { tsConfig?: { fileName: string }; tsPreCompilationDeps?: boolean };
  };

  it('SPEC-ARCH-05: options use tsconfig.base.json with tsPreCompilationDeps', () => {
    expect(config.options.tsConfig?.fileName).toBe('tsconfig.base.json');
    expect(config.options.tsPreCompilationDeps).toBe(true);
  });

  it('SPEC-ARCH-05: every named rule exists and every rule is an error', () => {
    const names = new Set(config.forbidden.map((r) => r.name));
    for (const n of [
      'no-circular',
      'layer-allow-list',
      'index-only',
      'kernel-pure',
      'measure-pure',
      'firebase-confined',
      'idb-confined',
      'pixelmatch-confined',
      'no-orphans',
      'no-test-in-src',
    ]) {
      expect(names.has(n), n).toBe(true);
    }
    for (const r of config.forbidden) expect(r.severity, r.name).toBe('error');
  });

  it('SPEC-ARCH-05, SPEC-ARCH-10: layer-allow-list has one clause per module, generated from modules.json', () => {
    const clauses = config.forbidden.filter((r) => r.name === 'layer-allow-list');
    expect(clauses).toHaveLength(modules.length);
    const sources = clauses.map((c) => String(c.from.path)).sort();
    expect(sources).toEqual(modules.map((m) => `^${m.path}/`).sort());
  });
});

describe('SPEC-ARCH-01, SPEC-ARCH-02, SPEC-ARCH-03, SPEC-ARCH-05, SPEC-ARCH-06 (a): the real tree', () => {
  it('SPEC-ARCH-01, SPEC-ARCH-02, SPEC-ARCH-03, SPEC-ARCH-05: dependency-cruiser over src/ reports zero violations', () => {
    const violations = depcruise(ROOT, 'src');
    expect(violations.map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`)).toEqual([]);
  });

  it('SPEC-ARCH-02: no feature module may import a platform module (table check)', () => {
    for (const m of modules.filter((x) => x.path.startsWith('src/features/'))) {
      for (const a of m.mayImport) {
        expect(moduleByAlias(a).path.startsWith('src/platform/'), `${m.name} -> ${a}`).toBe(false);
      }
    }
  });
});

describe('SPEC-ARCH-06 (b), SPEC-ARCH-04: tsconfig references equal modules.json', () => {
  for (const m of modules) {
    it(`SPEC-ARCH-04, SPEC-ARCH-06 (b): ${m.name} references equal its allowed modules`, () => {
      const expected = m.mayImport.map((a) => moduleByAlias(a).path).sort();
      expect(referencesOf(m.path)).toEqual(expected);
    });

    it(`SPEC-ARCH-04: ${m.name} tsconfig extends the base and writes under node_modules/.cache/tsc`, () => {
      const cfg = readJson<{ extends: string; compilerOptions: Record<string, unknown> }>(`${m.path}/tsconfig.json`);
      expect(String(cfg.compilerOptions.outDir)).toContain('node_modules/.cache/tsc/');
      expect(cfg.extends).toContain('tsconfig.base.json');
    });
  }

  it('SPEC-ARCH-04: kernel lib is ES2023+DOM, measure lib is ES2023 with no types', () => {
    const kernel = readJson<{ compilerOptions: { lib: string[] } }>('src/shared/kernel/tsconfig.json');
    const measure = readJson<{ compilerOptions: { lib: string[]; types: string[] } }>(
      'src/features/measure/tsconfig.json',
    );
    expect(kernel.compilerOptions.lib).toEqual(['ES2023', 'DOM']);
    expect(measure.compilerOptions.lib).toEqual(['ES2023']);
    expect(measure.compilerOptions.types).toEqual([]);
  });

  it('SPEC-ARCH-04: root tsconfig.json and tests/tsconfig.json reference every module', () => {
    const all = modules.map((m) => m.path).sort();
    expect(referencesOf('.').filter((p) => p.startsWith('src/'))).toEqual(all);
    expect(referencesOf('tests').filter((p) => p.startsWith('src/'))).toEqual(all);
  });
});

describe('SPEC-ARCH-00, SPEC-ARCH-06 (c): module layout', () => {
  for (const m of modules) {
    it(`SPEC-ARCH-00, SPEC-ARCH-06 (c): ${m.name} has index.ts and tsconfig.json`, () => {
      expect(existsSync(join(ROOT, m.path, 'index.ts'))).toBe(true);
      expect(existsSync(join(ROOT, m.path, 'tsconfig.json'))).toBe(true);
    });

    it(`SPEC-ARCH-00: ${m.name} ui/ and prompts/ folders match the table`, () => {
      expect(existsSync(join(ROOT, m.path, 'ui/index.ts'))).toBe(m.ui);
      expect(existsSync(join(ROOT, m.path, 'prompts'))).toBe(m.prompts);
    });
  }
});

describe('SPEC-ARCH-06 (d), SPEC-STACK-01: exact versions only', () => {
  it('SPEC-ARCH-06 (d), SPEC-STACK-01: package.json has no range specifiers', () => {
    const pkg = readJson<Record<string, Record<string, string> | undefined>>('package.json');
    const bad: string[] = [];
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, v] of Object.entries(pkg[section] ?? {})) {
        if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(v)) bad.push(`${section}.${name}@${v}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('SPEC-ARCH-06 (e), SPEC-KERNEL-01: runtime purity of kernel and measure', () => {
  it('SPEC-ARCH-06 (e): detector flags window, document., self. and fetch( but not property names or comments', () => {
    expect(findBrowserGlobals('const w = window.innerWidth')).toEqual(['window']);
    expect(findBrowserGlobals('document.title')).toEqual(['document']);
    expect(findBrowserGlobals('self.postMessage(1)')).toEqual(['self.']);
    expect(findBrowserGlobals('await fetch(url)')).toEqual(['fetch(']);
    expect(findBrowserGlobals('dom.document.scrollWidth + this.self.x')).toEqual([]);
    expect(findBrowserGlobals('// window document. self. fetch(\n/* window */ const a = 1')).toEqual([]);
    expect(findBrowserGlobals('interface S { document: { scrollWidth: number } }')).toEqual([]);
  });

  for (const alias of ['@kernel', '@measure']) {
    it(`SPEC-ARCH-06 (e), SPEC-KERNEL-01: ${alias} sources use no browser globals`, () => {
      const dir = join(ROOT, moduleByAlias(alias).path);
      const offenders: string[] = [];
      for (const f of listFiles(dir).filter((p) => /\.(ts|tsx|js)$/.test(p))) {
        const hits = findBrowserGlobals(readFileSync(f, 'utf8'));
        if (hits.length) offenders.push(`${f}: ${hits.join(',')}`);
      }
      expect(offenders).toEqual([]);
    });
  }
});

describe('SPEC-ARCH-06 (f), SPEC-ARCH-10: aliases equal modules.json', () => {
  const aliased = modules.filter((m): m is ModuleRow & { alias: string } => m.alias !== null);

  it('SPEC-ARCH-06 (f), SPEC-ARCH-10: tsconfig.base.json paths equal the table', () => {
    const { paths } = readJson<{ compilerOptions: { paths: Record<string, string[]> } }>(
      'tsconfig.base.json',
    ).compilerOptions;
    expect(paths).toEqual(Object.fromEntries(aliased.map((m) => [m.alias, [`./${m.path}/index.ts`]])));
  });

  it('SPEC-ARCH-06 (f), SPEC-ARCH-10: Vite/Vitest aliases (vite.aliases.ts) equal the table', async () => {
    // vite.aliases.ts belongs to tsconfig.node.json, so it is loaded at runtime rather than imported statically.
    const mod = (await import(pathToFileURL(join(ROOT, 'vite.aliases.ts')).href)) as {
      moduleAliases(): Record<string, string>;
    };
    const got = mod.moduleAliases();
    expect(Object.keys(got).sort()).toEqual(aliased.map((m) => m.alias).sort());
    for (const m of aliased) expect(resolve(got[m.alias] ?? ''), m.alias).toBe(resolve(ROOT, m.path, 'index.ts'));
  });

  it('SPEC-ARCH-10: vite.config.ts and vitest.config.ts take their aliases from moduleAliases()', () => {
    for (const f of ['vite.config.ts', 'vitest.config.ts']) {
      expect(readFileSync(join(ROOT, f), 'utf8'), f).toContain('moduleAliases()');
    }
  });
});

describe('SPEC-ARCH-06 (g), SPEC-ARCH-04, SPEC-ARCH-05: negative fixture', () => {
  const fixture = join(ROOT, 'tests/architecture/fixtures/violation');

  it('SPEC-ARCH-06 (g), SPEC-ARCH-04: tsc -b on the fixture fails with TS6307', () => {
    const tsc = join(ROOT, 'node_modules/typescript/bin/tsc');
    const r = spawnSync(process.execPath, [tsc, '-b', fixture], { encoding: 'utf8' });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain('TS6307');
  });

  it('SPEC-ARCH-06 (g), SPEC-ARCH-05: depcruise on the fixture reports layer-allow-list', () => {
    const hit = depcruise(fixture, 'src').find((v) => v.rule.name === 'layer-allow-list');
    expect(hit?.from).toBe('src/features/measure/index.ts');
    expect(hit?.to).toBe('src/platform/firebase/index.ts');
  });
});
