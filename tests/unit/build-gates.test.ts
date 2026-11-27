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
  it('SPEC-TEST-02, SPEC-FB-04: passes a clean build', () => {
    expect(run('check-dist.mjs', fakeDist()).status).toBe(0);
  });
  it('fails when the built CSS carries a Tailwind variable or a universal margin reset (it un-centres every dialog)', () => {
    const tw = run(
      'check-dist.mjs',
      fakeDist({ 'assets/index.css': ':root{--tw-ring-inset:var(--tw-empty,/*!*/ /*!*/)}' }),
    );
    expect(tw.status).toBe(1);
    expect(tw.stderr).toContain('--tw-');
    const preflight = '*,:after,:before,::backdrop{box-sizing:border-box;border:0 solid;margin:0;padding:0}';
    const reset = run('check-dist.mjs', fakeDist({ 'assets/index.css': preflight }));
    expect(reset.status).toBe(1);
    expect(reset.stderr).toContain('universal reset');
    expect(run('check-dist.mjs', fakeDist({ 'assets/index.css': '*{margin:0}' })).status).toBe(1);
    const ok = '*,:after,:before{box-sizing:border-box}body{margin:0}dialog.sheet{padding:0;margin:auto 0 0}';
    expect(run('check-dist.mjs', fakeDist({ 'assets/index.css': ok })).status).toBe(0);
  });
  it('fails when the React core is defined in two chunks (two React copies break every route)', () => {
    const core = 'function y(){}y.prototype.isReactComponent={}';
    const r = run('check-dist.mjs', fakeDist({ 'assets/jsx-runtime.js': core, 'assets/services.js': core }));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('React core defined in 2 chunks');
  });
  it('fails when react-dom does not import the chunk that holds the React core', () => {
    const r = run(
      'check-dist.mjs',
      fakeDist({
        'assets/react.js': 'function y(){}y.prototype.isReactComponent={}',
        'assets/index.js': 'var d={currentDispatcherRef:1}',
      }),
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('react-dom does not import');
  });
  it('passes when one chunk holds the React core and react-dom imports it', () => {
    const r = run(
      'check-dist.mjs',
      fakeDist({
        'assets/react.js': 'function y(){}y.prototype.isReactComponent={}',
        'assets/index.js': 'import"./react.js";var d={currentDispatcherRef:1}',
      }),
    );
    expect(r.status).toBe(0);
  });
  it.each(['__CUI_FAKE__', 'FakeAiEngine'])('SPEC-TEST-02, SPEC-FB-04: fails when %s is present', (marker) => {
    const r = run('check-dist.mjs', fakeDist({ 'assets/leak.js': `self.${marker}=1` }));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(marker);
  });
  const TOKEN = 'FIREBASE_APPCHECK_DEBUG_TOKEN';
  it.each([
    `if(self.${TOKEN})x()`,
    `typeof globalThis.${TOKEN}`,
    `e.${TOKEN}===!0`,
    `e.${TOKEN} == 1`,
    `e.${TOKEN}!=null`,
    `e.${TOKEN}!==void 0`,
    `self["${TOKEN}"]===1`,
  ])('SPEC-TEST-02, SPEC-FB-04: allows the SDK reading the debug token global: %s', (code) => {
    expect(run('check-dist.mjs', fakeDist({ 'assets/sdk.js': code })).status).toBe(0);
  });
  it.each([
    `self.${TOKEN}=1`,
    `globalThis.${TOKEN} = "abc"`,
    `t.${TOKEN}=e||!0`,
    `self["${TOKEN}"]=x`,
    `self['${TOKEN}']=x`,
    `self["${TOKEN}"] = x`,
    `self.${TOKEN}||=1`,
    `self.${TOKEN}??=1`,
    `self.${TOKEN}&&=1`,
    `self.${TOKEN} ||= 1`,
  ])('SPEC-TEST-02, SPEC-FB-04: fails on an assignment to the debug token global: %s', (code) => {
    const r = run('check-dist.mjs', fakeDist({ 'assets/leak.js': code }));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(TOKEN);
  });
  it('SPEC-TEST-02, SPEC-FB-04: fails when dist is missing', () => {
    expect(run('check-dist.mjs', join(tmpdir(), 'cui-no-such-dist')).status).toBe(1);
  });
});

describe('scripts/check-size.mjs', () => {
  const none = join(tmpdir(), 'cui-no-sample');
  it('SPEC-PERF-04, SPEC-DEMO-06: passes a small build; sample assets absent pass vacuously', () => {
    expect(run('check-size.mjs', fakeDist(), none).status).toBe(0);
  });
  it('SPEC-PERF-04, SPEC-DEMO-06: fails when initial JS exceeds 170 KB gzip', () => {
    const noise = Array.from({ length: 400_000 }, () => Math.random().toString(36).slice(2)).join('');
    const r = run('check-size.mjs', fakeDist({ 'assets/index.js': noise }), none);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('initial JS');
  });
  it('SPEC-PERF-04, SPEC-DEMO-06: fails on a non-woff2 font', () => {
    expect(run('check-size.mjs', fakeDist({ 'assets/a.woff': 'x' }), none).status).toBe(1);
  });
  it('SPEC-PERF-04, SPEC-DEMO-06: fails when a sample PNG exceeds 1.5 MB', () => {
    const sample = mkdtempSync(join(tmpdir(), 'cui-sample-'));
    dirs.push(sample);
    writeFileSync(join(sample, 'big.png'), Buffer.alloc(1.6 * 1024 * 1024));
    expect(run('check-size.mjs', fakeDist(), sample).status).toBe(1);
  });
});
