import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = (f: string) => readFileSync(`src/app/styles/${f}`, 'utf8');
const tokens = css('tokens.css');

describe('SPEC-UI-02, SPEC-UI-03, S10: shared and settings styles use tokens only, in light and dark', () => {
  it.each(['app.css', 'settings.css'])('SPEC-UI-02: %s has no hex literal and only uses defined tokens', (f) => {
    const src = css(f);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const used = new Set([...src.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1] as string));
    const own = new Set([...src.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1] as string));
    const missing = [...used].filter((v) => !own.has(v) && !tokens.includes(`${v}:`));
    expect(missing).toEqual([]);
  });

  it('S10: the colour roles the badges and panel use are redefined for dark mode', () => {
    const dark = tokens.slice(tokens.indexOf('prefers-color-scheme: dark'));
    for (const v of ['--text', '--text-muted', '--surface', '--border', '--accent', '--success', '--danger']) {
      expect(dark, v).toContain(`${v}:`);
    }
    expect(tokens).toContain(':root[data-theme="dark"]');
  });

  it('SPEC-UI-02: index.css imports the shared and settings styles', () => {
    const idx = css('index.css');
    expect(idx).toContain('./app.css');
    expect(idx).toContain('./settings.css');
  });
});
