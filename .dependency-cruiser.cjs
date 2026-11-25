// SPEC-ARCH-05 / SPEC-ARCH-10. The allow-lists are generated from tests/architecture/modules.json (single module table).
// Paths are relative to the cruised project root (`src/...`), so the negative fixture (a mini project with the same
// layout) is judged by the same rules when depcruise runs with its folder as cwd.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const table = JSON.parse(readFileSync(join(__dirname, 'tests/architecture/modules.json'), 'utf8'));
/** @type {{ name: string, path: string, alias: string | null, mayImport: string[], npm: string[] }[]} */
const modules = table.modules;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const modulePattern = (m) => `^${m.path}/`;
const byAlias = (alias) => {
  const m = modules.find((x) => x.alias === alias);
  if (!m) throw new Error(`modules.json: unknown alias ${alias}`);
  return m;
};
/** `firebase/app` -> resolved `node_modules/firebase/app/...`; `workbox-*` -> any workbox package. */
const npmPattern = (pkg) =>
  pkg.endsWith('*') ? `^node_modules/${esc(pkg.slice(0, -1))}[^/]*/` : `^node_modules/${esc(pkg)}/`;

const ownersOf = (test) => modules.filter((m) => m.npm.some(test));
const outside = (owners) => owners.map(modulePattern);

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No cycles (SPEC-ARCH-05).',
      from: {},
      to: { circular: true },
    },

    // layer-allow-list: one clause per module, from the SPEC section 3.2 table (modules and npm packages).
    ...modules.map((m) => ({
      name: 'layer-allow-list',
      severity: 'error',
      comment: `${m.name} may import ${m.mayImport.join(', ') || 'nothing'} and npm: ${m.npm.join(', ') || 'none'} (SPEC-ARCH-01).`,
      from: { path: modulePattern(m) },
      to: {
        pathNot: [modulePattern(m), ...m.mayImport.map((a) => modulePattern(byAlias(a))), ...m.npm.map(npmPattern)],
      },
    })),

    // index-only: cross-module imports resolve to <module>/index.ts (SPEC-ARCH-03).
    ...modules.map((m) => ({
      name: 'index-only',
      severity: 'error',
      comment: `${m.name} is reached through ${m.alias ?? 'its index'} only (SPEC-ARCH-03).`,
      from: { path: '^src/', pathNot: modulePattern(m) },
      to: { path: modulePattern(m), pathNot: `^${m.path}/index\\.ts$` },
    })),

    {
      name: 'kernel-pure',
      severity: 'error',
      comment: 'kernel imports only zod (SPEC-KERNEL-01).',
      from: { path: '^src/shared/kernel/' },
      to: { pathNot: ['^src/shared/kernel/', '^node_modules/zod/'] },
    },
    {
      name: 'measure-pure',
      severity: 'error',
      comment: 'measure imports only kernel and pixelmatch; no react (SPEC-ARCH-05).',
      from: { path: '^src/features/measure/' },
      to: { pathNot: ['^src/features/measure/', '^src/shared/kernel/', '^node_modules/pixelmatch/'] },
    },
    {
      name: 'firebase-confined',
      severity: 'error',
      comment: 'firebase/* only under platform/firebase and platform/ai-engine (SPEC-ARCH-05).',
      from: { pathNot: outside(ownersOf((p) => p.startsWith('firebase/'))) },
      to: { path: '^node_modules/(@firebase|firebase)/' },
    },
    {
      name: 'firebase-confined',
      severity: 'error',
      comment: 'firebase/ai only under platform/ai-engine (SPEC-ARCH-05).',
      from: { pathNot: outside(ownersOf((p) => p === 'firebase/ai')) },
      to: { path: '^node_modules/firebase/ai/' },
    },
    {
      name: 'idb-confined',
      severity: 'error',
      comment: 'idb only in platform/storage (SPEC-ARCH-05).',
      from: { pathNot: outside(ownersOf((p) => p === 'idb')) },
      to: { path: '^node_modules/idb/' },
    },
    {
      name: 'pixelmatch-confined',
      severity: 'error',
      comment: 'pixelmatch only in features/measure (SPEC-ARCH-05).',
      from: { pathNot: outside(ownersOf((p) => p === 'pixelmatch')) },
      to: { path: '^node_modules/pixelmatch/' },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment: 'No unreferenced files, except entries and the declared exceptions (SPEC-ARCH-05).',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|json)$',
          '[.]d[.]ts$',
          '^src/app/sw[.]ts$',
          '^src/app/main[.]tsx$',
          '^src/app/index[.]ts$', // app exports no public API (SPEC §4.13)
          '^src/app/testing/',
          '(^|/)snippet[.]js$',
        ],
      },
      to: {},
    },
    {
      name: 'no-test-in-src',
      severity: 'error',
      comment: 'Production code never imports tests/ or vitest (SPEC-ARCH-05).',
      from: { path: '^src/', pathNot: '^src/app/testing/' },
      to: { path: ['^tests/', '^node_modules/vitest/', '^node_modules/@vitest/'] },
    },
    {
      name: 'no-test-in-src',
      severity: 'error',
      comment: 'app/testing/** is imported only from app/compose.ts (SPEC-ARCH-05).',
      from: { path: '^src/', pathNot: ['^src/app/compose[.]ts$', '^src/app/testing/'] },
      to: { path: '^src/app/testing/' },
    },
    {
      name: 'no-test-in-src',
      severity: 'error',
      comment: 'app/compose.ts reaches app/testing/** only through dynamic import() (SPEC-TEST-02).',
      from: { path: '^src/app/compose[.]ts$' },
      to: { path: '^src/app/testing/', dependencyTypesNot: ['dynamic-import'] },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.base.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    moduleSystems: ['es6', 'cjs'],
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
    cache: false,
  },
};
