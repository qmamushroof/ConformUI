// @vitest-environment jsdom
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../sample-site');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const pages = { design: 'design.html', flawed: 'flawed/index.html', fixed: 'fixed/index.html' } as const;

/** Resolve `--name: value` declarations for a page: site.css defaults, then the page's inline :root override. */
function vars(page: string): Record<string, string> {
  const out: Record<string, string> = {};
  const inline = [...read(page).matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '').join('\n');
  for (const block of [read('assets/site.css'), inline]) {
    for (const rootRule of block.matchAll(/:root\s*\{([^}]*)\}/g)) {
      for (const d of (rootRule[1] ?? '').matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[d[1] ?? ''] = (d[2] ?? '').trim();
    }
  }
  return out;
}
const html = (p: string) => new DOMParser().parseFromString(read(p), 'text/html');

function* walk(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

describe('sample-site files', () => {
  it('SPEC-DEMO-01, PRD-F-10.4: the three pages and the shared stylesheet exist', () => {
    for (const p of [...Object.values(pages), 'assets/site.css']) expect(existsSync(join(root, p)), p).toBe(true);
  });

  it('SPEC-DEMO-01, SPEC-DEMO-06: an OFL font ships with its licence file; no external requests of any kind', () => {
    const files = [...walk(root)].map((f) => f.slice(root.length + 1).replaceAll('\\', '/'));
    expect(files.some((f) => f.startsWith('assets/') && f.endsWith('.woff2'))).toBe(true);
    expect(files.some((f) => /^assets\/(OFL|LICENSE)/i.test(f))).toBe(true);
    for (const f of files.filter((f) => /\.(html|css)$/.test(f))) {
      const src = readFileSync(join(root, f), 'utf8');
      expect(src, f).not.toMatch(/(?:https?:)?\/\/(?!www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}/i);
      expect(src, f).not.toMatch(/@import|<script|fonts\.googleapis/i);
      for (const u of src.matchAll(/(?:src|href)\s*=\s*"([^"]+)"|url\(([^)]+)\)/g)) {
        const target = (u[1] ?? u[2] ?? '').replace(/['"]/g, '');
        if (target.startsWith('#') || target.startsWith('data:')) continue;
        expect(target, `${f}: ${target}`).not.toMatch(/^[a-z]+:|^\/\//i);
      }
    }
  });

  it('S28, PRD-D-28, PRD-D-15: unbranded copy ("Sample Co."), no third-party tool or company names, no personal data', () => {
    for (const p of Object.values(pages)) {
      const doc = html(p);
      expect(doc.body.textContent ?? '', p).toContain('Sample Co.');
      expect(doc.title, p).toMatch(/Sample/);
      expect(read(p), p).not.toMatch(
        /claude|anthropic|openai|gemini|firebase|figma|copilot|cursor|@[a-z0-9-]+\.[a-z]/i,
      );
    }
  });

  it('SPEC-DEMO-01: nav = logo (not a link), links, one primary button; footer and a text input present on every page', () => {
    for (const p of Object.values(pages)) {
      const doc = html(p);
      const nav = doc.querySelector('nav');
      expect(nav, p).not.toBeNull();
      expect(nav?.querySelector('.logo')?.textContent, p).toContain('Sample Co.');
      expect(nav?.querySelector('.logo a'), p).toBeNull();
      expect(nav?.querySelectorAll('button').length, p).toBe(1);
      expect(doc.querySelector('footer'), p).not.toBeNull();
      const input = doc.querySelector('input[type=text], input[type=email]');
      expect(input, p).not.toBeNull();
      expect(input?.hasAttribute('value'), p).toBe(false);
      expect(doc.querySelector('meta[name=viewport]'), p).not.toBeNull();
    }
  });
});

describe('planted defects (SPEC-DEMO-01 table)', () => {
  const navLinks = (p: string) => html(p).querySelectorAll('nav a[href]').length;
  const art = (p: string) => html(p).querySelector('.hero-art svg[role=img]');

  it('SPEC-DEMO-01 #1: hero illustration 520x400 present in design and fixed, absent in flawed', () => {
    for (const p of [pages.design, pages.fixed]) {
      const svg = art(p);
      expect(svg, p).not.toBeNull();
      expect(svg?.getAttribute('width')).toBe('520');
      expect(svg?.getAttribute('height')).toBe('400');
    }
    expect(art(pages.flawed)).toBeNull();
    expect(html(pages.flawed).querySelector('.hero-art')).toBeNull();
  });

  it('SPEC-DEMO-01 #2: CTA width 220 design/fixed, 132 flawed', () => {
    expect(vars(pages.design)['cta-w']).toBe('220px');
    expect(vars(pages.fixed)['cta-w']).toBe('220px');
    expect(vars(pages.flawed)['cta-w']).toBe('132px');
  });

  it('SPEC-DEMO-01 #3: h1 56 / subtitle 20 in design and fixed; h1 28 / subtitle 32 in flawed', () => {
    for (const p of [pages.design, pages.fixed]) {
      expect([vars(p)['h1-size'], vars(p)['sub-size']]).toEqual(['56px', '20px']);
    }
    expect([vars(pages.flawed)['h1-size'], vars(pages.flawed)['sub-size']]).toEqual(['28px', '32px']);
  });

  it('SPEC-DEMO-01 #4: 4 nav links in design and fixed, 3 in flawed (the missing one is the last)', () => {
    expect(navLinks(pages.design)).toBe(4);
    expect(navLinks(pages.fixed)).toBe(4);
    expect(navLinks(pages.flawed)).toBe(3);
    const labels = (p: string) => [...html(p).querySelectorAll('nav a[href]')].map((a) => a.textContent?.trim());
    expect(labels(pages.flawed)).toEqual(labels(pages.design).slice(0, 3));
  });

  it('SPEC-DEMO-01 #5: only the flawed page carries the mobile defect (nav out of flow, 454 px wide = 390 + 64)', () => {
    expect(vars(pages.flawed)['mobile-nav-width']).toBe('454px');
    expect(read(pages.flawed)).toMatch(/@media[^{]*max-width[^{]*\{[^}]*nav[^}]*position:\s*absolute/s);
    for (const p of [pages.design, pages.fixed]) {
      expect(read(p), p).not.toMatch(/position:\s*absolute/);
      expect(vars(p)['mobile-nav-width'], p).toBeUndefined();
    }
  });

  it('SPEC-DEMO-01 #6: section gap 96 design, 64 flawed AND fixed (left unfixed, -33.3%)', () => {
    expect(vars(pages.design)['section-gap']).toBe('96px');
    expect(vars(pages.flawed)['section-gap']).toBe('64px');
    expect(vars(pages.fixed)['section-gap']).toBe('64px');
  });

  it('SPEC-DEMO-01 #7: CTA hue differs slightly and icon is a chevron in flawed (arrow in design/fixed)', () => {
    const icon = (p: string) => html(p).querySelector('.cta svg')?.getAttribute('data-icon');
    expect(icon(pages.design)).toBe('arrow');
    expect(icon(pages.fixed)).toBe('arrow');
    expect(icon(pages.flawed)).toBe('chevron');
    expect(vars(pages.fixed)['cta-bg']).toBe(vars(pages.design)['cta-bg']);
    expect(vars(pages.flawed)['cta-bg']).not.toBe(vars(pages.design)['cta-bg']);
  });

  it('SPEC-DEMO-01: flawed hue difference is below colour_delta_e (0.08 OKLab): a Judged item, not Measured', () => {
    const oklab = (hex: string) => {
      const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
        const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
      return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
      ];
    };
    const a = oklab(vars(pages.design)['cta-bg'] ?? '');
    const b = oklab(vars(pages.flawed)['cta-bg'] ?? '');
    const d = Math.hypot(...a.map((x, i) => x - (b[i] ?? 0)));
    expect(d).toBeGreaterThan(0.01);
    expect(d).toBeLessThan(0.08);
  });

  it('PRD-F-10.3, SPEC-DEMO-01: variants differ only where planted (normalised markup diff)', () => {
    const norm = (p: string) =>
      read(p)
        .replace(/<style>[\s\S]*?<\/style>/g, '')
        .replace(/<title>[\s\S]*?<\/title>/, '')
        .replace(/<link[^>]*>/, '')
        .replace(/\s+/g, '');
    expect(norm(pages.fixed)).toBe(norm(pages.design));
    const expectedFlawed = norm(pages.design)
      .replace(/<divclass="hero-art">[\s\S]*?<\/svg><\/div>/, '')
      .replace(/<li><ahref="#about">About<\/a><\/li>/, '')
      .replace(/<svg[^>]*data-icon="arrow"[\s\S]*?<\/svg>/, '');
    const flawed = norm(pages.flawed).replace(/<svg[^>]*data-icon="chevron"[\s\S]*?<\/svg>/, '');
    expect(flawed).toBe(expectedFlawed);
  });

  it('SPEC-DEMO-01: hero and features carry aria-labelled section landmarks (spacing is measured between them)', () => {
    for (const p of Object.values(pages)) {
      const labels = [...html(p).querySelectorAll('section[aria-label]')].map((s) => s.getAttribute('aria-label'));
      expect(labels, p).toEqual(expect.arrayContaining(['Hero', 'Features']));
    }
  });
});
