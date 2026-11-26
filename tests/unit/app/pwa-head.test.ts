import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');

describe('SPEC-PWA-01 head links', () => {
  it('SPEC-PWA-01: favicon.ico link is 32x32', () => {
    expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="32x32" />');
  });
  it('SPEC-PWA-01: svg favicon link', () => {
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
  });
  it('SPEC-PWA-01: apple-touch-icon link points at the 180 px png', () => {
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />');
  });
  it('SPEC-PWA-01: icon.svg is not linked as a favicon', () => {
    expect(html).not.toContain('href="/icon.svg"');
  });
});
