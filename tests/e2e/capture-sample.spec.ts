import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const repo = resolve(fileURLToPath(import.meta.url), '../../..');
const sampleDir = join(repo, 'src/features/demo/sample');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const run = (out: string) =>
  spawnSync(process.execPath, ['scripts/capture-sample.mjs', out], { cwd: repo, encoding: 'utf8', timeout: 150_000 });

// Pixels and layout floats depend on the OS font rasteriser, so only same-machine determinism and
// platform-independent snapshot facts are compared with the committed outputs.
test('SPEC-DEMO-07: two capture runs are byte-identical and snapshot facts match the committed ones', async () => {
  test.setTimeout(300_000);
  const tmp = mkdtempSync(join(tmpdir(), 'capture-'));
  try {
    const a = join(tmp, 'a');
    const b = join(tmp, 'b');
    const ra = run(a);
    expect(ra.status, ra.stderr).toBe(0);
    const rb = run(b);
    expect(rb.status, rb.stderr).toBe(0);
    expect(readdirSync(a).sort()).toEqual(readdirSync(b).sort());
    for (const f of readdirSync(a)) expect(sha(readFileSync(join(b, f))), f).toBe(sha(readFileSync(join(a, f))));
    expect(ra.stdout).toMatch(/^[0-9a-f]{64} {2}flawed-mobile\.png$/m);

    const facts = (dir: string, n: string) => {
      const d = JSON.parse(readFileSync(join(dir, `${n}.dom.json`), 'utf8'));
      return {
        overflow: d.overflow,
        viewport: d.viewport.width,
        navLinks: d.elements.filter(
          (e: { kind: string; selector: string }) => e.kind === 'link' && e.selector.includes('nav'),
        ).length,
        cta: d.elements.find(
          (e: { kind: string; text?: string }) => e.kind === 'link' && e.text?.includes('Start free'),
        )?.box.w,
      };
    };
    for (const n of ['flawed-desktop', 'flawed-mobile', 'fixed-desktop', 'fixed-mobile']) {
      expect(facts(a, n), n).toEqual(facts(sampleDir, n));
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
