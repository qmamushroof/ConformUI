import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '../../../src/features/dom-snippet/snippet.js'), 'utf8');

// SPEC-SNIP-07 banned tokens (privacy + no network + no DOM mutation).
const BANNED = [
  '.value',
  '.checked',
  '.selectedIndex',
  'document.cookie',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'navigator.credentials',
  'fetch',
  'XMLHttpRequest',
  'sendBeacon',
  'WebSocket',
  'EventSource',
  'import(',
  'new Image',
  '.src =',
  '.src=',
  'location =',
  'location=',
  'window.open',
  'postMessage',
  'appendChild',
  'innerHTML =',
  'innerHTML=',
  'setAttribute',
];

describe('snippet.js static scan', () => {
  it('SPEC-SNIP-02, PRD-F-13.3: the file is a real snippet, not a placeholder (one IIFE, ES2020, no imports)', () => {
    expect(source.length).toBeGreaterThan(1000);
    expect(source).toMatch(/\(function\s*\(\)\s*\{/);
    expect(source).not.toMatch(/^\s*(import|export)\s/m);
    expect(source).toContain('conformui.dom-snapshot');
  });

  it.each(BANNED)('SPEC-SNIP-07, PRD-F-13.7: source never contains %j', (token) => {
    expect(source.includes(token)).toBe(false);
  });

  it('SPEC-SNIP-07: no style writes', () => {
    expect(source).not.toMatch(/\.style\.[A-Za-z]+\s*=[^=]/);
    expect(source).not.toMatch(/\.style\.setProperty|classList\.(add|remove|toggle)/);
  });

  it('SPEC-SNIP-06: console is used only as the DevTools copy fallback', () => {
    const uses = source.match(/console\.\w+/g) ?? [];
    expect(uses.every((u) => u === 'console.log')).toBe(true);
    expect(uses.length).toBeLessThanOrEqual(1);
  });
});
