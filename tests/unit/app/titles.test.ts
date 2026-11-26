import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { projectIdOf, routeTitle } from '../../../src/app/titles';

describe('routeTitle', () => {
  it.each([
    ['/', 'Projects · ConformUI'],
    ['/welcome', 'Welcome · ConformUI'],
    ['/snippet', 'DOM snippet · ConformUI'],
    ['/settings', 'Settings · ConformUI'],
    ['/nope', 'Not found · ConformUI'],
    ['/p/a/b/c/d', 'Not found · ConformUI'],
  ])('SPEC-APP-04: %s is titled "%s"', (path, title) => {
    expect(routeTitle(path)).toBe(title);
  });

  it('SPEC-APP-04: project routes name the project: "Run · <project> · ConformUI"', () => {
    expect(routeTitle('/p/p1/run/r1', 'Checkout')).toBe('Run · Checkout · ConformUI');
    expect(routeTitle('/p/p1/contract', 'Checkout')).toBe('Contract · Checkout · ConformUI');
    expect(routeTitle('/p/p1', 'Checkout')).toBe('Project · Checkout · ConformUI');
  });

  it('SPEC-APP-04: a project route without a known name drops the name instead of printing "undefined"', () => {
    expect(routeTitle('/p/p1/run/r1')).toBe('Run · ConformUI');
    expect(routeTitle('/p/p1/run/r1', '')).toBe('Run · ConformUI');
  });

  it('SPEC-APP-04: a trailing slash is the same route', () => {
    expect(routeTitle('/settings/')).toBe('Settings · ConformUI');
  });
});

describe('projectIdOf', () => {
  it('SPEC-APP-04: extracts the id from every project route and nothing else', () => {
    expect(projectIdOf('/p/p1')).toBe('p1');
    expect(projectIdOf('/p/p1/contract')).toBe('p1');
    expect(projectIdOf('/p/p%201/run/r1')).toBe('p 1');
    expect(projectIdOf('/')).toBeUndefined();
    expect(projectIdOf('/settings')).toBeUndefined();
    expect(projectIdOf('/p/')).toBeUndefined();
  });
});

describe('index.html', () => {
  const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  it('SPEC-APP-05, PRD-P-11: no third-party script or stylesheet is referenced from the page', () => {
    const urls = [...html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)];
    expect(urls).toEqual([]);
  });
});
