import { DomSnapshotV1Schema } from '@kernel';
import { SNIPPET_VERSION, snippetSource } from '@snippet';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom has no layout: boxes come from data-box="x,y,w,h" (viewport coords); missing data-box = zero area.
const proto = Element.prototype;
const realRect = proto.getBoundingClientRect;
// Runs the snippet as page code (global scope), returning its completion value.
const exec = (): unknown =>
  new Function(`var r =
${snippetSource}
; return r;`)();
const g = globalThis as unknown as Record<string, unknown>;

function setDoc(html: string, o: { clientWidth?: number; scrollWidth?: number; scrollHeight?: number } = {}) {
  document.body.innerHTML = html;
  const de = document.documentElement;
  Object.defineProperty(de, 'clientWidth', { configurable: true, value: o.clientWidth ?? 390 });
  Object.defineProperty(de, 'scrollWidth', { configurable: true, value: o.scrollWidth ?? o.clientWidth ?? 390 });
  Object.defineProperty(de, 'scrollHeight', { configurable: true, value: o.scrollHeight ?? 800 });
}

function run(): { out: unknown; json: string; copy: ReturnType<typeof vi.fn> } {
  const copy = vi.fn();
  g.copy = copy;
  const out = exec();
  const json = copy.mock.calls[0]?.[0] as string;
  return { out, json, copy };
}
function snap() {
  return JSON.parse(run().json) as ReturnType<typeof DomSnapshotV1Schema.parse>;
}

beforeEach(() => {
  proto.getBoundingClientRect = function (this: Element) {
    const b = this.getAttribute('data-box');
    const [x = 0, y = 0, w = 0, h = 0] = b ? b.split(',').map(Number) : [];
    return { x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON() {} } as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'innerText', {
    configurable: true,
    get() {
      return this.textContent;
    },
  });
  document.title = 'Sample landing page';
});
afterEach(() => {
  proto.getBoundingClientRect = realRect;
  Reflect.deleteProperty(g, 'copy');
  vi.restoreAllMocks();
});

describe('snippet.js behaviour', () => {
  it('SPEC-SNIP-01, SPEC-SNIP-06, PRD-F-13.2: output validates against DomSnapshotV1 and copy() receives the JSON', () => {
    setDoc(
      '<header data-box="0,0,390,60"><nav data-box="0,0,390,60"><a href="/a" data-box="0,10,40,20">Home</a></nav></header><h1 data-box="0,70,300,40">Hello</h1>',
    );
    const { out, json, copy } = run();
    const s = DomSnapshotV1Schema.parse(JSON.parse(json));
    expect(copy).toHaveBeenCalledTimes(1);
    expect(s.snippetVersion).toBe(SNIPPET_VERSION);
    expect(s.viewport.width).toBe(window.innerWidth);
    expect(s.document.clientWidth).toBe(390);
    expect(s.elements.length).toBe(4);
    expect(out).toBe(`ConformUI snapshot copied: 4 elements, ${window.innerWidth}×${window.innerHeight}`);
    expect(Number.isNaN(Date.parse(s.capturedAt))).toBe(false);
  });

  it('SPEC-SNIP-06: falls back to console.log when copy is not a function', () => {
    setDoc('<h1 data-box="0,0,100,20">Hi</h1>');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const out = exec();
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0]?.[0] as string).schema).toBe('conformui.dom-snapshot');
    expect(out).toContain('ConformUI snapshot copied: 1 elements');
  });

  it('SPEC-SNIP-02: selects each kind in document order with parent = nearest captured ancestor', () => {
    setDoc(
      `<main data-box="0,0,390,500"><div><h2 data-box="0,0,100,20">Title</h2><p data-box="0,30,100,20">Some text</p>
       <button data-box="0,60,80,30">Go</button><img alt="pic" data-box="0,100,50,50"><input data-box="0,160,100,20" aria-label="Email"></div></main>`,
    );
    const s = snap();
    expect(s.elements.map((e) => e.kind)).toEqual(['landmark', 'heading', 'text', 'button', 'image', 'control']);
    expect(s.elements.map((e) => e.parent)).toEqual([null, 0, 0, 0, 0, 0]);
    expect(s.elements.map((e) => e.i)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.elements[1]).toMatchObject({ tag: 'h2', level: 2 });
  });

  it('SPEC-SNIP-02: skips zero-area and hidden elements; records hidden landmarks as visible:false', () => {
    setDoc(
      `<h1>no box</h1><h2 style="display:none" data-box="0,0,10,10">gone</h2><h3 style="visibility:hidden" data-box="0,0,10,10">inv</h3>
       <nav style="display:none" aria-label="menu"></nav><footer data-box="0,700,390,60">F</footer>`,
    );
    const s = snap();
    expect(s.elements.map((e) => [e.tag, e.visible])).toEqual([
      ['nav', false],
      ['footer', true],
    ]);
  });

  it('SPEC-SNIP-02: text blocks need >= 2 chars of own text and no captured text-block child; input type=hidden is skipped', () => {
    setDoc(
      `<p data-box="0,0,10,10">x</p><p data-box="0,10,100,10"><span data-box="0,10,50,10">inner</span></p>
       <ul data-box="0,20,50,50"><li data-box="0,20,50,10">Item</li></ul><input type="hidden" name="t" data-box="0,0,5,5"><a href="/" data-box="0,0,5,5"> </a>`,
    );
    const s = snap();
    expect(s.elements.map((e) => `${e.tag}:${e.kind}`)).toEqual(['span:text', 'li:text', 'a:link']);
  });

  it('SPEC-SNIP-02, PRD-F-13.3: caps at 1500 elements and sets truncated', () => {
    setDoc('<a href="/x" data-box="0,0,10,10">link</a>'.repeat(1600));
    const s = snap();
    expect(s.elements).toHaveLength(1500);
    expect(s.truncated).toBe(true);
  });

  it('SPEC-SNIP-03: selector uses unique non-generated #id, else data-testid, else nth-of-type path', () => {
    setDoc(
      `<div id="hero"><a href="/1" id="cta" data-box="0,0,10,10">One</a><a href="/2" data-testid="two" data-box="0,0,10,10">Two</a>
       <a href="/3" data-box="0,0,10,10">Three</a></div>
       <a href="/4" id="auto12345" data-box="0,0,10,10">Four</a><a href="/5" id="dup" data-box="0,0,10,10">Five</a><i id="dup"></i>`,
    );
    const sel = snap().elements.map((e) => e.selector);
    expect(sel[0]).toBe('#cta');
    expect(sel[1]).toBe('[data-testid="two"]');
    expect(sel[2]).toBe('#hero > a:nth-of-type(3)');
    expect(sel[3]).toBe('body > a:nth-of-type(1)');
    expect(sel[4]).toBe('body > a:nth-of-type(2)');
  });

  it('SPEC-SNIP-03: path is deterministic, ends at the element and is at most 5 levels', () => {
    setDoc(
      '<div><div><div><div><div><div><div><a href="/" data-box="0,0,10,10">Deep</a></div></div></div></div></div></div></div>',
    );
    const a = snap().elements[0];
    const b = snap().elements[0];
    expect(a?.selector).toBe(b?.selector);
    expect(a?.selector.split(' > ').length).toBeLessThanOrEqual(5);
    expect(a?.selector.split(' > ').pop()).toBe('a:nth-of-type(1)');
  });

  it('SPEC-SNIP-04: accessible name order aria-label > aria-labelledby > alt > label[for] > title > own text; capped 120/200', () => {
    setDoc(
      `<span id="lbl">Labelled by</span>
       <a href="/1" aria-label="Aria" data-box="0,0,5,5">own</a>
       <a href="/2" aria-labelledby="lbl" data-box="0,0,5,5">own</a>
       <img alt="Alt" title="T" data-box="0,0,5,5">
       <label for="f" data-box="0,0,5,5">Field label</label><input id="f" data-box="0,0,5,5">
       <a href="/3" title="Titled" data-box="0,0,5,5">own</a>
       <a href="/4" data-box="0,0,5,5">  own   text
 here </a>
       <a href="/5" data-box="0,0,5,5">${'z'.repeat(300)}</a>`,
    );
    const el = snap().elements;
    const byName = (n: string) => el.find((e) => e.name === n);
    expect(byName('Aria')?.tag).toBe('a');
    expect(byName('Labelled by')?.tag).toBe('a');
    expect(byName('Alt')?.tag).toBe('img');
    expect(el.find((e) => e.tag === 'input')?.name).toBe('Field label');
    expect(byName('Titled')?.tag).toBe('a');
    expect(byName('own text here')?.text).toBe('own text here');
    const long = el[el.length - 1];
    expect(long?.name).toHaveLength(120);
    expect(long?.text).toHaveLength(200);
  });

  it('SPEC-SNIP-05, PRD-F-13.4: overflow, beyondViewport and clippedByAncestor flags', () => {
    setDoc(
      `<div style="overflow:hidden" data-box="0,0,200,100"><a href="/a" data-box="150,10,100,20">Clip</a></div>
       <a href="/b" data-box="300,200,154,40">Wide</a><a href="/c" data-box="-5,300,20,20">Left</a><a href="/d" data-box="10,400,50,20">Ok</a>`,
      { clientWidth: 390, scrollWidth: 454 },
    );
    const s = snap();
    expect(s.overflow).toEqual({ horizontal: true, horizontalPx: 64 });
    const f = (n: string) => s.elements.find((e) => e.name === n)?.flags;
    expect(f('Clip')).toEqual({ beyondViewport: false, clippedByAncestor: true, textClipped: false });
    expect(f('Wide')?.beyondViewport).toBe(true);
    expect(f('Left')?.beyondViewport).toBe(true);
    expect(f('Ok')).toEqual({ beyondViewport: false, clippedByAncestor: false, textClipped: false });
  });

  it('SPEC-SNIP-05: no horizontal overflow when widths are equal; textClipped when text exceeds a hiding box', () => {
    setDoc('<p style="overflow:hidden" data-box="0,0,50,20" id="p">Long long text</p>');
    const p = document.getElementById('p') as HTMLElement;
    Object.defineProperty(p, 'scrollWidth', { value: 120 });
    Object.defineProperty(p, 'clientWidth', { value: 50 });
    const s = snap();
    expect(s.overflow).toEqual({ horizontal: false, horizontalPx: 0 });
    expect(s.elements[0]?.flags.textClipped).toBe(true);
  });

  it('SPEC-SNIP-01: box in page coordinates (scroll added, 2 decimals) and computed style values', () => {
    setDoc(
      `<h1 data-box="10.123,20.456,100.999,30" style="font-size:28px;font-weight:700;line-height:36px;font-family:'Inter', sans-serif;margin-top:8px;padding-bottom:4px;opacity:.5">T</h1>`,
    );
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 5 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 100 });
    const e = snap().elements[0];
    expect(e?.box).toEqual({ x: 15.12, y: 120.46, w: 101, h: 30 });
    expect(e?.style).toMatchObject({
      fontSize: 28,
      fontWeight: 700,
      lineHeight: 36,
      fontFamily: 'Inter',
      marginTop: 8,
      paddingBottom: 4,
      opacity: 0.5,
      gap: null,
    });
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 0 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('SPEC-SNIP-06: over 1 MiB drops text of text blocks first, then halves elements from the end and sets truncated', () => {
    const long = 'w'.repeat(190);
    // Dropping text is enough here.
    setDoc(`<p data-box="0,0,10,10">${long}</p>`.repeat(1450));
    const s1 = snap();
    expect(s1.elements.every((e) => e.text === undefined)).toBe(true);
    expect(s1.elements).toHaveLength(1450);
    expect(s1.truncated).toBe(false);

    // Names (not dropped) push it over, so elements are halved.
    setDoc(
      `<a href="/x" data-box="0,0,10,10" title="${'t'.repeat(115)}" aria-label="${'n'.repeat(115)}">${'k'.repeat(190)}</a>`.repeat(
        1500,
      ),
    );
    const { json } = run();
    expect(json.length).toBeLessThanOrEqual(1024 * 1024);
    const s2 = JSON.parse(json);
    expect(s2.elements.length).toBeLessThan(1500);
    expect(s2.truncated).toBe(true);
  });

  it('SPEC-SNIP-07, PRD-F-13.7: page URL is origin + pathname only; title capped at 120', () => {
    window.history.replaceState({}, '', '/path/page?token=SECRET#frag');
    document.title = 'T'.repeat(300);
    setDoc('<h1 data-box="0,0,10,10">x</h1>');
    const s = snap();
    expect(s.page.url).toBe(`${window.location.origin}/path/page`);
    expect(s.page.title).toHaveLength(120);
    window.history.replaceState({}, '', '/');
  });

  it('SPEC-SNIP-07, PRD-F-13.7: never emits form values, hidden inputs or password text; does not mutate the DOM', () => {
    setDoc(
      `<form data-box="0,0,300,300"><input id="e" value="SECRET-VALUE-123" data-box="0,0,100,20" aria-label="Email">
       <input type="password" value="PW-HUNTER2" data-box="0,30,100,20"><input type="hidden" value="HID-TOKEN-9" data-box="0,0,5,5">
       <textarea data-box="0,60,100,40">TEXTAREA-SECRET</textarea>
       <select data-box="0,110,100,20"><option selected>SELECT-SECRET</option></select></form>`,
    );
    (document.getElementById('e') as HTMLInputElement).checked = true;
    // biome-ignore lint/suspicious/noDocumentCookie: the test needs a real cookie to prove the snippet never reads it
    document.cookie = 'sid=COOKIE-SECRET-77';
    localStorage.setItem('k', 'LS-SECRET-55');
    const before = document.documentElement.outerHTML;
    const { json } = run();
    for (const s of [
      'SECRET-VALUE-123',
      'PW-HUNTER2',
      'HID-TOKEN-9',
      'TEXTAREA-SECRET',
      'SELECT-SECRET',
      'COOKIE-SECRET-77',
      'LS-SECRET-55',
    ])
      expect(json).not.toContain(s);
    const controls = (JSON.parse(json) as { elements: { kind: string; text?: string }[] }).elements.filter(
      (e) => e.kind === 'control',
    );
    expect(controls).toHaveLength(4);
    expect(controls.every((c) => c.text === undefined)).toBe(true);
    expect(document.documentElement.outerHTML).toBe(before);
  });

  it('SPEC-SNIP-07: makes no network calls', () => {
    setDoc(
      '<a href="/x" data-box="0,0,10,10">go</a><img alt="i" src="https://example.invalid/a.png" data-box="0,0,10,10">',
    );
    const f = vi.fn();
    g.fetch = f;
    run();
    expect(f).not.toHaveBeenCalled();
    Reflect.deleteProperty(g, 'fetch');
  });
});
