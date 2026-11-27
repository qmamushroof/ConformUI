import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

type ManualChunks = (id: string) => string | undefined;
type ViteFn = (env: { mode: string; command: string }) => {
  build?: { rollupOptions?: { output?: { manualChunks?: ManualChunks } } };
};

// Production-host finding (15.3): zod and the kernel schemas shared one chunk and the jitless config ran in the entry
// chunk after it, so zod's `new Function` probe still ran (a CSP eval violation). The config module must live in the
// same chunk as zod so it executes before the kernel schemas are built.
describe('vite chunking for zod-jitless', () => {
  let manual: ManualChunks | undefined;
  beforeAll(async () => {
    // vite.config.ts belongs to tsconfig.node.json, so it is loaded at runtime rather than imported statically.
    const mod = (await import(pathToFileURL(join(process.cwd(), 'vite.config.ts')).href)) as { default: ViteFn };
    manual = mod.default({ mode: 'production', command: 'build' }).build?.rollupOptions?.output?.manualChunks;
  });

  it('SPEC-SEC-08: zod and the jitless config module land in the same named chunk', () => {
    expect(typeof manual).toBe('function');
    const zod = manual?.('/repo/node_modules/zod/v4/core/schemas.js');
    expect(zod).toBeTruthy();
    expect(manual?.('/repo/src/app/zod-jitless.ts')).toBe(zod);
  });
  it('SPEC-SEC-08: kernel and other modules are not forced into that chunk', () => {
    expect(manual?.('/repo/src/shared/kernel/schemas.ts')).toBeUndefined();
    expect(manual?.('/repo/node_modules/react/index.js')).toBeUndefined();
  });
});
