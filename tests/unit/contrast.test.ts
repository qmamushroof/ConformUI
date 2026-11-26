import { describe, expect, it } from 'vitest';
import { darkVars, failingPairs, lightVars, PAIRS, ratio, read } from './token-css';

const css = read('src/app/styles/tokens.css');

describe('SPEC-UI-03 contrast of design tokens', () => {
  it('SPEC-UI-03: checks every listed pair (guards against silently dropping pairs)', () => {
    expect(PAIRS.length).toBe(30);
  });

  it('SPEC-UI-03: light theme has no pair below its ratio', () => {
    expect(failingPairs(lightVars(css))).toEqual([]);
  });

  it('SPEC-UI-03, S10: dark theme (prefers-color-scheme) has no pair below its ratio', () => {
    expect(failingPairs(darkVars(css))).toEqual([]);
  });

  it('SPEC-UI-02: spec reference ratios hold (text on bg 19.54 light, accent on bg 5.17 light, 7.69 dark)', () => {
    expect(ratio(lightVars(css), '--text', '--bg')).toBeCloseTo(19.54, 1);
    expect(ratio(lightVars(css), '--accent', '--bg')).toBeCloseTo(5.17, 1);
    expect(ratio(darkVars(css), '--accent', '--bg')).toBeCloseTo(7.69, 1);
  });

  it('SPEC-UI-03: fails when a token drops below its ratio (muted text lightened in light theme)', () => {
    const weak = { ...lightVars(css), '--text-muted': 'oklch(75% 0.018 260)' };
    expect(failingPairs(weak).some((f) => f.startsWith('--text-muted on --bg'))).toBe(true);
  });

  it('SPEC-UI-03: fails when a dark token drops below its ratio (danger darkened in dark theme)', () => {
    const weak = { ...darkVars(css), '--danger': 'oklch(30% 0.1 25)' };
    expect(failingPairs(weak).length).toBeGreaterThan(0);
  });

  it('SPEC-UI-03: fails when the focus ring falls under 3:1', () => {
    const weak = { ...lightVars(css), '--focus': '#e0e0ff' };
    expect(failingPairs(weak).some((f) => f.startsWith('--focus'))).toBe(true);
  });
});
