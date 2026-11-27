import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Header {
  key: string;
  value: string;
}
interface Rule {
  source: string;
  headers: Header[];
}

const cfg = JSON.parse(readFileSync('firebase.json', 'utf8')) as { hosting: { headers: Rule[] } };
const all = cfg.hosting.headers.find((r) => r.source === '**');
const header = (key: string): string | undefined => all?.headers.find((h) => h.key === key)?.value;
const csp = header('Content-Security-Policy') ?? '';
const directive = (name: string): string[] => {
  const d = csp
    .split(';')
    .map((s) => s.trim().split(/\s+/))
    .find((p) => p[0] === name);
  return d ? d.slice(1) : [];
};

describe('firebase.json hosting headers', () => {
  it('SPEC-SEC-08: a "**" rule carries the enforced Content-Security-Policy, not the report-only header (15.3 proof: zero violations on Hosting)', () => {
    expect(all).toBeDefined();
    expect(csp).not.toBe('');
    expect(header('Content-Security-Policy-Report-Only')).toBeUndefined();
  });
  it('SPEC-SEC-08: default-src self and object-src none, base-uri none, form-action self', () => {
    expect(directive('default-src')).toEqual(["'self'"]);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'none'"]);
    expect(directive('form-action')).toEqual(["'self'"]);
  });
  it('SPEC-SEC-08: every SPEC origin is allowed in the right directive', () => {
    expect(directive('script-src')).toEqual([
      "'self'",
      'https://www.google.com/recaptcha/',
      'https://www.gstatic.com/recaptcha/',
    ]);
    expect(directive('frame-src')).toEqual(['https://www.google.com/recaptcha/']);
    expect(directive('worker-src')).toEqual(["'self'"]);
    expect(directive('img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(directive('connect-src')).toEqual([
      "'self'",
      'data:',
      'https://firebasevertexai.googleapis.com',
      'https://firebaseremoteconfig.googleapis.com',
      'https://firebaseinstallations.googleapis.com',
      'https://content-firebaseappcheck.googleapis.com',
      'https://www.google.com',
    ]);
  });
  it('SPEC-SEC-08, edge: no unsafe-eval, no wildcard source, no http origin', () => {
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toMatch(/(^|\s)\*(\s|;|$)/);
    expect(csp).not.toContain('http://');
    expect(directive('script-src')).not.toContain("'unsafe-inline'");
  });
  it('SPEC-SEC-08: security headers ride along on the same rule', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('no-referrer');
    expect(header('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });
  it('SPEC-DEPLOY-01: existing cache headers are kept', () => {
    const sources = cfg.hosting.headers.map((r) => r.source);
    expect(sources).toContain('/{sw.js,manifest.webmanifest}');
    expect(sources).toContain('/assets/**');
  });
});
