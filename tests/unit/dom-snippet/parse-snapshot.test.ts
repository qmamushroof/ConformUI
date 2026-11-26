import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAX_SNAPSHOT_ELEMENTS } from '@kernel';
import { describe, expect, it } from 'vitest';
import { parseSnapshot } from '../../../src/features/dom-snippet';

const root = resolve(__dirname, '../../..');
const sample = (n: string) => readFileSync(resolve(root, 'src/features/demo/sample', n), 'utf8');
const fixture = (n: string) => readFileSync(resolve(root, 'tests/fixtures/snapshots', n), 'utf8');
const flawedMobile = sample('flawed-mobile.dom.json');
const mobileWidth = JSON.parse(flawedMobile).viewport.width as number;

function errorsOf(text: string, w = mobileWidth): string[] {
  const r = parseSnapshot(text, { cssWidth: w });
  if (r.ok) throw new Error('expected failure');
  return r.errors;
}
// biome-ignore lint/suspicious/noExplicitAny: test helper edits arbitrary JSON
function mutate(fn: (o: Record<string, any>) => void): string {
  const o = JSON.parse(flawedMobile);
  fn(o);
  return JSON.stringify(o);
}

describe('parseSnapshot', () => {
  it.each(['flawed-mobile', 'flawed-desktop', 'fixed-mobile', 'fixed-desktop'])(
    'SPEC-SNIP-08, PRD-F-13.5: accepts the real snapshot %s',
    (name) => {
      const text = sample(`${name}.dom.json`);
      const w = JSON.parse(text).viewport.width;
      const r = parseSnapshot(text, { cssWidth: w });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.snapshot.elements.length).toBeGreaterThan(0);
        expect(r.warnings).toEqual([]);
      }
    },
  );

  it('SPEC-SNIP-08: tolerates the snippet confirmation line and console noise around the JSON', () => {
    const text = `VM12:3 noise\n${flawedMobile}\nConformUI snapshot copied: 40 elements, 390x844\nundefined`;
    expect(parseSnapshot(text, { cssWidth: mobileWidth }).ok).toBe(true);
  });

  it('SPEC-SNIP-08: tolerates a BOM and surrounding whitespace', () => {
    expect(parseSnapshot(`﻿ \n\t${flawedMobile}  \r\n`, { cssWidth: mobileWidth }).ok).toBe(true);
  });

  it('SPEC-SNIP-08: invalid JSON names the line', () => {
    const e = errorsOf(fixture('invalid-json.txt'));
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/^Not valid JSON \(line \d+\)/);
  });

  it('SPEC-SNIP-08: invalid JSON reports the right line', () => {
    expect(errorsOf(fixture('invalid-json.txt'))[0]).toBe('Not valid JSON (line 5)');
  });

  it.each(['', '   ', 'hello world', '[1,2]', '"str"', '42', 'null'])(
    'SPEC-SNIP-08: rejects non-object input %j without throwing',
    (text) => {
      const e = errorsOf(text);
      expect(e.length).toBeGreaterThanOrEqual(1);
      expect(e.length).toBeLessThanOrEqual(5);
    },
  );

  it('SPEC-SNIP-08: wrong version is "not a ConformUI snapshot v1"', () => {
    expect(errorsOf(fixture('wrong-version.json'))).toEqual(['This is not a ConformUI snapshot v1']);
    expect(errorsOf(mutate((o) => (o.version = 2)))).toEqual(['This is not a ConformUI snapshot v1']);
  });

  it('SPEC-SNIP-08: wrong schema tag is "not a ConformUI snapshot v1"', () => {
    expect(errorsOf(mutate((o) => (o.schema = 'other')))).toEqual(['This is not a ConformUI snapshot v1']);
    expect(errorsOf('{"foo":1}')).toEqual(['This is not a ConformUI snapshot v1']);
  });

  it('SPEC-SNIP-08, SPEC-SEC-12: oversized input is SNAPSHOT_TOO_LARGE before parsing', () => {
    const text = `{"pad":"${'x'.repeat(1024 * 1024)}"}`;
    expect(errorsOf(text)).toEqual(['SNAPSHOT_TOO_LARGE']);
  });

  it('SPEC-SEC-12: the cap counts bytes, not characters', () => {
    const text = `{"pad":"${'é'.repeat(600 * 1024)}"}`;
    expect(errorsOf(text)).toEqual(['SNAPSHOT_TOO_LARGE']);
  });

  it('SPEC-SNIP-08: missing fields give human messages, at most 5', () => {
    const e = errorsOf(
      mutate((o) => {
        delete o.viewport;
        delete o.dpr;
        delete o.document;
        delete o.overflow;
        delete o.capturedAt;
        delete o.truncated;
        delete o.page;
      }),
    );
    expect(e.length).toBe(5);
    expect(e.join('\n')).toMatch(/viewport|dpr|document|overflow|capturedAt|truncated|page/);
  });

  it('SPEC-SNIP-08: nested type error reads "elements[1].box.w must be a number"', () => {
    const e = errorsOf(mutate((o) => (o.elements[1].box.w = 'wide')));
    expect(e).toContain('elements[1].box.w must be a number');
  });

  it('SPEC-SNIP-08: many bad elements still yield at most 5 messages', () => {
    const e = errorsOf(
      mutate((o) => {
        for (const el of o.elements) el.box = 'x';
      }),
    );
    expect(e.length).toBe(5);
  });

  it('SPEC-SNIP-08: element-count cap is enforced', () => {
    const e = errorsOf(
      mutate((o) => {
        const el = o.elements[0];
        o.elements = Array.from({ length: MAX_SNAPSHOT_ELEMENTS + 1 }, () => el);
      }),
    );
    expect(e.join(' ')).toMatch(/elements/);
  });

  it('SPEC-SNIP-08: extra unknown fields are ignored and not kept', () => {
    const r = parseSnapshot(
      mutate((o) => {
        o.extra = { a: 1 };
      }),
      { cssWidth: mobileWidth },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect('extra' in r.snapshot).toBe(false);
  });

  it('SPEC-SNIP-08, PRD-F-13.6: warns dom-viewport-mismatch when |width - cssWidth| > 1', () => {
    const r = parseSnapshot(flawedMobile, { cssWidth: mobileWidth + 2 });
    expect(r.ok && r.warnings).toEqual(['dom-viewport-mismatch']);
  });

  it('PRD-F-13.6: a difference of exactly 1 does not warn', () => {
    const r = parseSnapshot(flawedMobile, { cssWidth: mobileWidth + 1 });
    expect(r.ok && r.warnings).toEqual([]);
  });

  it('SPEC-SNIP-08: truncated snapshot warns "truncated"', () => {
    const r = parseSnapshot(
      mutate((o) => (o.truncated = true)),
      { cssWidth: mobileWidth },
    );
    expect(r.ok && r.warnings).toEqual(['truncated']);
  });

  it('SPEC-SNIP-08: truncated and mismatched width give both warnings', () => {
    const r = parseSnapshot(
      mutate((o) => (o.truncated = true)),
      { cssWidth: mobileWidth + 100 },
    );
    expect(r.ok && [...r.warnings].sort()).toEqual(['dom-viewport-mismatch', 'truncated']);
  });

  it('SPEC-SEC-12: a javascript: page URL is kept as inert data, never executed', () => {
    const r = parseSnapshot(
      mutate((o) => (o.page.url = 'javascript:alert(1)')),
      { cssWidth: mobileWidth },
    );
    expect(r.ok).toBe(true);
  });
});
