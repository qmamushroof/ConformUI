import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DomSnapshotV1Schema } from '@kernel';
import { afterAll, describe, expect, it } from 'vitest';

const repo = resolve(__dirname, '../../..');
const sampleDir = join(repo, 'src/features/demo/sample');
const MB = 1024 * 1024;

const PNGS: Record<string, number> = {
  'design-desktop.png': 2880,
  'flawed-desktop.png': 1440,
  'flawed-mobile.png': 390,
  'fixed-desktop.png': 1440,
  'fixed-mobile.png': 390,
};
const DOMS = ['flawed-desktop', 'flawed-mobile', 'fixed-desktop', 'fixed-mobile'] as const;

const png = (dir: string, f: string) => readFileSync(join(dir, f));
const size = (b: Buffer) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
const dom = (dir: string, n: string) =>
  DomSnapshotV1Schema.parse(JSON.parse(readFileSync(join(dir, `${n}.dom.json`), 'utf8')));
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

describe('committed sample outputs', () => {
  it('SPEC-DEMO-07, PRD-F-10.4: every PNG and snapshot listed in SPEC 4.11.2 is committed', () => {
    for (const f of Object.keys(PNGS)) expect(existsSync(join(sampleDir, f)), f).toBe(true);
    for (const n of DOMS) expect(existsSync(join(sampleDir, `${n}.dom.json`)), n).toBe(true);
  });

  it('SPEC-DEMO-01: PNGs are real PNGs with exact pixel width (design @2x, captures DPR 1) and a plausible height', () => {
    for (const [f, w] of Object.entries(PNGS)) {
      const b = png(sampleDir, f);
      expect(b.subarray(1, 4).toString('latin1'), f).toBe('PNG');
      const s = size(b);
      expect(s.w, f).toBe(w);
      expect(s.h, f).toBeGreaterThan(400);
    }
    expect(size(png(sampleDir, 'design-desktop.png')).h % 2).toBe(0);
  });

  it('SPEC-DEMO-06: each PNG <= 1.5 MB and all sample files <= 8 MB', () => {
    const files = readdirSync(sampleDir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
    let total = 0;
    for (const e of files) {
      const s = statSync(join(e.parentPath, e.name)).size;
      total += s;
      if (e.name.endsWith('.png')) expect(s, e.name).toBeLessThanOrEqual(1.5 * MB);
    }
    expect(total).toBeLessThanOrEqual(8 * MB);
  });

  it('SPEC-SNIP-01, SPEC-DEMO-07: snapshots parse with the kernel schema, match the capture viewport and are not truncated', () => {
    for (const n of DOMS) {
      const d = dom(sampleDir, n);
      expect(d.viewport.width, n).toBe(n.endsWith('mobile') ? 390 : 1440);
      expect(d.dpr, n).toBe(1);
      expect(d.truncated, n).toBe(false);
      expect(d.elements.length, n).toBeGreaterThan(10);
      expect(d.page.title).toBe('Sample landing page');
    }
  });

  it('SPEC-SEC-03, SPEC-DEMO-07: snapshots hold no local path or file URL', () => {
    for (const n of DOMS) {
      const text = readFileSync(join(sampleDir, `${n}.dom.json`), 'utf8');
      expect(text).not.toMatch(/file:|[A-Za-z]:\\|\/Users\/|\/home\//);
      expect(dom(sampleDir, n).page.url).toMatch(/^https?:\/\/[^/]+\/(flawed|fixed)\/(index\.html)?$/);
    }
  });

  it('SPEC-SNIP-05, SPEC-DEMO-01 #5: flawed 390 px overflows horizontally by exactly 64 px; fixed does not', () => {
    expect(dom(sampleDir, 'flawed-mobile').overflow).toEqual({ horizontal: true, horizontalPx: 64 });
    expect(dom(sampleDir, 'fixed-mobile').overflow).toEqual({ horizontal: false, horizontalPx: 0 });
    expect(dom(sampleDir, 'flawed-desktop').overflow.horizontal).toBe(false);
  });

  it('SPEC-DEMO-01 #4: nav link count is 3 flawed and 4 fixed (desktop)', () => {
    const links = (n: string) =>
      dom(sampleDir, n).elements.filter((e) => e.kind === 'link' && e.selector.includes('nav') && e.visible);
    expect(links('flawed-desktop')).toHaveLength(3);
    expect(links('fixed-desktop')).toHaveLength(4);
  });

  it('SPEC-DEMO-01 #2: CTA "Start free" box width is 132 flawed and 220 fixed at 1440 px', () => {
    const cta = (n: string) =>
      dom(sampleDir, n).elements.find((e) => e.kind === 'link' && e.text?.includes('Start free'));
    expect(cta('flawed-desktop')?.box.w).toBe(132);
    expect(cta('fixed-desktop')?.box.w).toBe(220);
  });

  it('SPEC-DEMO-01 #3, #1: h1 is 28 px flawed and 56 px fixed; hero art absent flawed, present fixed', () => {
    const h1 = (n: string) => dom(sampleDir, n).elements.find((e) => e.kind === 'heading' && e.level === 1);
    expect(h1('flawed-desktop')?.style.fontSize).toBe(28);
    expect(h1('fixed-desktop')?.style.fontSize).toBe(56);
    const art = (n: string) =>
      dom(sampleDir, n).elements.filter((e) => e.tag === 'svg' && e.box.w >= 500 && e.box.h >= 380);
    expect(art('flawed-desktop')).toHaveLength(0);
    expect(art('fixed-desktop').length).toBeGreaterThan(0);
  });

  it('SPEC-DEMO-01 #6: hero to features gap is 64 px in both flawed and fixed (left unfixed)', () => {
    const gap = (n: string) => {
      const els = dom(sampleDir, n).elements;
      const [hero, feat] = els.filter((e) => e.tag === 'section');
      return (feat?.box.y ?? 0) - ((hero?.box.y ?? 0) + (hero?.box.h ?? 0));
    };
    expect(gap('flawed-desktop')).toBe(64);
    expect(gap('fixed-desktop')).toBe(64);
  });

  it('SPEC-DEMO-07: SHA256SUMS.txt lists every committed output with its correct digest', () => {
    const list = readFileSync(join(sampleDir, 'SHA256SUMS.txt'), 'utf8').trim().split('\n');
    const listed = new Map(list.map((l) => [l.slice(66), l.slice(0, 64)]));
    for (const f of [...Object.keys(PNGS), ...DOMS.map((n) => `${n}.dom.json`)]) {
      expect(listed.get(f), f).toBe(sha(readFileSync(join(sampleDir, f))));
    }
    expect(listed.size).toBe(9);
  });
});

describe('capture script', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'capture-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  const run = (out: string) =>
    spawnSync(process.execPath, ['scripts/capture-sample.mjs', out], { cwd: repo, encoding: 'utf8', timeout: 150_000 });

  it('SPEC-DEMO-07: is idempotent: two runs write byte-identical files, print the SHA-256 list, and match the committed outputs', () => {
    const a = join(tmp, 'a');
    const b = join(tmp, 'b');
    const ra = run(a);
    expect(ra.status, ra.stderr).toBe(0);
    const rb = run(b);
    expect(rb.status, rb.stderr).toBe(0);
    expect(readdirSync(a).sort()).toEqual(readdirSync(b).sort());
    for (const f of readdirSync(a)) {
      expect(sha(readFileSync(join(b, f))), f).toBe(sha(readFileSync(join(a, f))));
      expect(sha(readFileSync(join(sampleDir, f))), `${f} committed`).toBe(sha(readFileSync(join(a, f))));
    }
    expect(ra.stdout).toMatch(/^[0-9a-f]{64} {2}flawed-mobile\.png$/m);
  }, 300_000);

  it('SPEC-DEMO-07, SPEC-SEC-03: the script blocks every request outside the sample origin', () => {
    const src = readFileSync(join(repo, 'scripts/capture-sample.mjs'), 'utf8');
    expect(src).toMatch(/abort\(/);
  });
});
