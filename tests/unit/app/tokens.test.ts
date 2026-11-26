import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { darkVars, lightVars, normalise, read, resolve, type Vars } from '../token-css';

const app = read('src/app/styles/tokens.css');
const proto = read('design/prototype/assets/tokens.css');

const canon = (v: Vars) =>
  Object.entries(v)
    .map(([k, x]) => `${k}: ${normalise(x)}`)
    .sort();

describe('SPEC-UI-02, S30: tokens match the prototype', () => {
  it('SPEC-UI-02: light variables equal the prototype, name for name and value for value', () => {
    expect(canon(lightVars(app))).toEqual(canon(lightVars(proto)));
  });

  it('SPEC-UI-02, S10: dark variables equal the prototype', () => {
    expect(canon(darkVars(app))).toEqual(canon(darkVars(proto)));
  });

  it.each([
    ['--accent', '#2563eb', '#60a5fa'],
    ['--danger', '#b42318', '#ff8a80'],
    ['--success', '#0f7a3a', '#6fe39a'],
  ])('SPEC-UI-02: %s resolves to the owner colours', (name, light, dark) => {
    expect(resolve(lightVars(app), name).toLowerCase()).toBe(light);
    expect(resolve(darkVars(app), name).toLowerCase()).toBe(dark);
  });

  it('SPEC-UI-02: type scale, radius and spacing values', () => {
    const v = lightVars(app);
    expect(v['--font-size-xs']).toBe('0.75rem');
    expect(v['--font-size-sm']).toBe('0.875rem');
    expect(v['--font-size-md']).toBe('1rem');
    expect(v['--font-size-3xl']).toBe('1.75rem');
    expect(v['--radius-sm']).toBe('3px');
    expect(v['--radius-md']).toBe('4px');
    expect(v['--radius-lg']).toBe('6px');
    expect(v['--space-1']).toBe('4px');
    expect(v['--layout-target']).toBe('44px');
  });

  it('SPEC-UI-02: no removed hues or tinted backgrounds (S30)', () => {
    const names = Object.keys(lightVars(app));
    expect(names.filter((n) => /major|minor|review|[a-z]-bg$/.test(n))).toEqual([]);
  });

  it('SPEC-UI-02: tokens.tailwind.css maps the same theme as the generator output', () => {
    const lines = (s: string) =>
      s
        .split('\n')
        .filter((l) => l.trim().startsWith('--') || l.includes('@theme') || l.includes('@custom-variant'))
        .map(normalise);
    expect(lines(read('src/app/styles/tokens.tailwind.css'))).toEqual(lines(read('design/tokens.tailwind.css')));
  });
});

describe('SPEC-PWA-03: fonts and import order', () => {
  const index = read('src/app/styles/index.css');
  const imports = [...index.matchAll(/@import\s+["']([^"']+)["']/g)].map((m) => m[1] as string);
  const fonts = read('src/app/styles/fonts.css');

  it('SPEC-PWA-03: declares exactly the five Latin woff2 faces (Sans 400/500/600, Mono 400/500)', () => {
    const faces = [
      ...fonts.matchAll(/font-family:\s*"([^"]+)";[^}]*?font-weight:\s*(\d+);[^}]*?src:\s*url\(([^)]+)\)/g),
    ].map((m) => `${m[1]} ${m[2]} ${(m[3] as string).split('/').pop()}`);
    expect(faces.sort()).toEqual(
      [
        'IBM Plex Mono 400 ibm-plex-mono-latin-400-normal.woff2',
        'IBM Plex Mono 500 ibm-plex-mono-latin-500-normal.woff2',
        'IBM Plex Sans 400 ibm-plex-sans-latin-400-normal.woff2',
        'IBM Plex Sans 500 ibm-plex-sans-latin-500-normal.woff2',
        'IBM Plex Sans 600 ibm-plex-sans-latin-600-normal.woff2',
      ].sort(),
    );
  });

  it('SPEC-PWA-03: no .woff fallback and no non-Latin subset is referenced', () => {
    expect(/\.woff(?!2)/.test(fonts)).toBe(false);
    expect(/cyrillic|greek|vietnamese|latin-ext|italic/.test(fonts)).toBe(false);
  });

  it('SPEC-PWA-03: every referenced font file exists in the installed package', () => {
    for (const m of fonts.matchAll(/url\(([^)]+)\)/g)) {
      expect(existsSync(join('src/app/styles', m[1] as string))).toBe(true);
    }
  });

  it('SPEC-PWA-03: the body and mono families match the token stacks', () => {
    const v = lightVars(app);
    expect(v['--font-body']).toMatch(/^"IBM Plex Sans"/);
    expect(v['--font-mono']).toMatch(/^"IBM Plex Mono"/);
  });

  it('SPEC-UI-02: fonts.css and tokens.css come after tailwindcss, tokens.tailwind.css last of the three', () => {
    expect(imports.indexOf('tailwindcss')).toBeGreaterThanOrEqual(0);
    expect(imports.indexOf('./fonts.css')).toBeGreaterThan(imports.indexOf('tailwindcss'));
    expect(imports.indexOf('./tokens.css')).toBeGreaterThan(imports.indexOf('tailwindcss'));
    expect(imports.indexOf('./tokens.tailwind.css')).toBeGreaterThan(imports.indexOf('./tokens.css'));
  });
});

describe('SPEC-UI-02: no hex literal outside the token files', () => {
  const allowed = new Set(['src/app/styles/tokens.css', 'src/app/styles/tokens.tailwind.css']);
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|css)$/.test(n) ? [p.replaceAll('\\', '/')] : [];
    });

  it('SPEC-UI-02: no #rgb / #rrggbb / #rrggbbaa in src outside the token files', () => {
    const offenders = walk('src')
      .filter((f) => !allowed.has(f))
      .filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('SPEC-UI-02: the scan sees the token files (guards a wrong root)', () => {
    expect(walk('src')).toContain('src/app/styles/tokens.css');
    expect(/#[0-9a-fA-F]{6}\b/.test(read('src/app/styles/tokens.css'))).toBe(true);
  });
});
