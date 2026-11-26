import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// SPEC-PWA-01, SPEC-PWA-03, SPEC-PWA-04: assertions on a real production build into a temp directory.
let out = '';
let manifest: Record<string, unknown>;
let precacheUrls: string[];
let swText = '';

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'cui-pwa-'));
  const r = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--emptyOutDir'], {
    encoding: 'utf8',
  });
  expect(r.status, r.stderr || r.stdout).toBe(0);
  manifest = JSON.parse(readFileSync(join(out, 'manifest.webmanifest'), 'utf8'));
  swText = readFileSync(join(out, 'sw.js'), 'utf8');
  precacheUrls = [...swText.matchAll(/"url":\s*"([^"]+)"/g)].map((m) => m[1] as string);
}, 170_000);

afterAll(() => {
  if (out) rmSync(out, { recursive: true, force: true });
});

describe('SPEC-PWA manifest (§4.13.3)', () => {
  it('SPEC-PWA-01: scalar fields match the SPEC table', () => {
    expect(manifest).toMatchObject({
      id: '/',
      start_url: '/',
      scope: '/',
      name: 'ConformUI: design acceptance testing',
      short_name: 'ConformUI',
      display: 'standalone',
      lang: 'en',
      categories: ['developer', 'productivity', 'utilities'],
      theme_color: '#2563EB',
      background_color: '#FFFFFF',
    });
  });
  it('SPEC-PWA-01: no share_target (P1)', () => {
    expect(manifest).not.toHaveProperty('share_target');
  });
  it('SPEC-PWA-01, SPEC-PWA-02: icons are 192/512 any and 512 maskable, and every file exists', () => {
    const icons = manifest.icons as { src: string; sizes: string; type: string; purpose: string }[];
    expect(icons.map((i) => [i.sizes, i.purpose, i.type])).toEqual([
      ['192x192', 'any', 'image/png'],
      ['512x512', 'any', 'image/png'],
      ['512x512', 'maskable', 'image/png'],
    ]);
    for (const i of icons) expect(existsSync(join(out, i.src)), i.src).toBe(true);
  });
  it('SPEC-PWA-01: the built page links the favicons and apple-touch icon', () => {
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    expect(html).toMatch(/rel="apple-touch-icon"[^>]*href="\/apple-touch-icon-180x180\.png"/);
    expect(html).toContain('/favicon.ico');
    expect(html).toContain('/favicon.svg');
  });
});

describe('SPEC-PWA-03 precache manifest', () => {
  it('SPEC-PWA-03: lists exactly 5 .woff2 font files and no .woff', () => {
    expect(precacheUrls.filter((u) => u.endsWith('.woff2'))).toHaveLength(5);
    expect(precacheUrls.filter((u) => /\.woff(?!2)/.test(u))).toEqual([]);
    expect(readdirSync(join(out, 'assets')).filter((f) => /\.woff$/.test(f))).toEqual([]);
  });
  it('SPEC-PWA-03: precaches the app shell and every built JS chunk including lazy ones', () => {
    expect(precacheUrls).toContain('index.html');
    const chunks = readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.js'));
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) expect(precacheUrls, c).toContain(`assets/${c}`);
  });
  it('SPEC-DEMO-06: every built png, svg and webp asset is precached', () => {
    const imgs = readdirSync(join(out, 'assets')).filter((f) => /\.(png|svg|webp)$/.test(f));
    for (const f of imgs) expect(precacheUrls, f).toContain(`assets/${f}`);
  });
  it('SPEC-PWA-04: no cross-origin URL is precached or routed', () => {
    expect(precacheUrls.filter((u) => /^https?:/.test(u))).toEqual([]);
    for (const host of ['googleapis', 'firebaseinstallations', 'firebaseappcheck', 'recaptcha', 'gstatic']) {
      expect(swText).not.toContain(host);
    }
  });
});

describe('SPEC-DEMO-06: the sample opens offline', () => {
  it('SPEC-DEMO-06: the precache lists every sample PNG and JSON file (design, flawed, fixed, contract, pre-computed)', () => {
    const assets = precacheUrls.filter((u) => u.startsWith('assets/'));
    const count = (re: RegExp) => assets.filter((u) => re.test(u)).length;
    expect(count(/.png$/), 'pngs').toBeGreaterThanOrEqual(5);
    // 4 DOM snapshots, the contract and extraction.json; the three small pre-computed files are inlined (under 4 KB) into the lazy chunk, which is precached too.
    expect(count(/.json$/), 'json files').toBeGreaterThanOrEqual(6);
  });
});
