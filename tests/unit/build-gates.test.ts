import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// The scripts are the CI gates (SPEC-TEST-02, SPEC-FB-04, SPEC-PERF-04); prove they fail when they should.
const dirs: string[] = [];
function fakeDist(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'cui-dist-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<script type="module" src="/assets/index.js"></script>');
  writeFileSync(join(dir, 'assets', 'index.js'), 'console.log(1)');
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}
function run(script: string, ...args: string[]) {
  return spawnSync(process.execPath, [`scripts/${script}`, ...args], { encoding: 'utf8' });
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('scripts/check-dist.mjs', () => {
  it('passes a clean build', () => {
    expect(run('check-dist.mjs', fakeDist()).status).toBe(0);
  });
  it.each(['__CUI_FAKE__', 'FakeAiEngine', 'FIREBASE_APPCHECK_DEBUG_TOKEN'])('fails when %s is present', (marker) => {
    const r = run('check-dist.mjs', fakeDist({ 'assets/leak.js': `self.${marker}=1` }));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(marker);
  });
  it('fails when dist is missing', () => {
    expect(run('check-dist.mjs', join(tmpdir(), 'cui-no-such-dist')).status).toBe(1);
  });
});

describe('scripts/check-size.mjs', () => {
  const none = join(tmpdir(), 'cui-no-sample');
  it('passes a small build; sample assets absent pass vacuously', () => {
    expect(run('check-size.mjs', fakeDist(), none).status).toBe(0);
  });
  it('fails when initial JS exceeds 170 KB gzip', () => {
    const noise = Array.from({ length: 400_000 }, () => Math.random().toString(36).slice(2)).join('');
    const r = run('check-size.mjs', fakeDist({ 'assets/index.js': noise }), none);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('initial JS');
  });
  it('fails on a non-woff2 font', () => {
    expect(run('check-size.mjs', fakeDist({ 'assets/a.woff': 'x' }), none).status).toBe(1);
  });
  it('fails when a sample PNG exceeds 1.5 MB', () => {
    const sample = mkdtempSync(join(tmpdir(), 'cui-sample-'));
    dirs.push(sample);
    writeFileSync(join(sample, 'big.png'), Buffer.alloc(1.6 * 1024 * 1024));
    expect(run('check-size.mjs', fakeDist(), sample).status).toBe(1);
  });
});
