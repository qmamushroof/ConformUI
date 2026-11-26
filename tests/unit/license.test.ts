import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string): string => readFileSync(p, 'utf8');
const pkg = JSON.parse(read('package.json')) as { license: string; repository: { url: string } };

describe('license and package metadata', () => {
  it('SPEC-DEPLOY-04, PRD-D-13: package.json license is Apache-2.0', () => {
    expect(pkg.license).toBe('Apache-2.0');
  });
  it('SPEC-DEPLOY-04, PRD-D-30: repository url is a real GitHub URL with no placeholder', () => {
    expect(pkg.repository.url).toMatch(/^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/);
    expect(pkg.repository.url).not.toContain('<');
  });
  it('SPEC-DEPLOY-04: LICENSE is the unmodified Apache-2.0 text', () => {
    const text = read('LICENSE');
    expect(text).toContain('Apache License\n'.trimEnd());
    expect(text).toContain('Version 2.0, January 2004');
    expect(text).toContain('END OF TERMS AND CONDITIONS');
  });
  it('SPEC-DEPLOY-04: NOTICE carries the copyright line', () => {
    const text = read('NOTICE');
    expect(text).toContain('ConformUI');
    expect(text).toContain('Copyright 2026 ConformUI contributors');
  });
});
