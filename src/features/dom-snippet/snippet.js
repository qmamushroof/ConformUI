// ConformUI DOM snippet (SPEC-SNIP-02..07). Run it in the DevTools console of your own page.
// It reads layout, text and computed styles only, sends nothing anywhere and changes nothing on the page.
(function () {
  'use strict';
  var SNIPPET_VERSION = '1.0.0';
  var MAX_ELEMENTS = 1500;
  var MAX_BYTES = 1024 * 1024;

  var LANDMARK = 'header, nav, main, footer, aside, section[aria-label], [role=banner], [role=navigation], [role=main], [role=contentinfo]';
  var HEADING = 'h1, h2, h3, h4, h5, h6';
  var LINK = 'a[href]';
  var BUTTON = 'button, [role=button]';
  var IMAGE = 'img, svg[role=img], picture, [role=img]';
  var CONTROL = 'input:not([type=hidden]), select, textarea';
  var TEXT = 'p, li, span, label';
  var NON_TEXT = [LANDMARK, HEADING, LINK, BUTTON, IMAGE, CONTROL].join(', ');
  var ALL = NON_TEXT + ', ' + TEXT;

  var IMPLICIT_ROLE = {
    header: 'banner', nav: 'navigation', main: 'main', footer: 'contentinfo', aside: 'complementary',
    section: 'region', a: 'link', button: 'button', img: 'img', select: 'combobox', textarea: 'textbox'
  };

  function collapse(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }
  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }
  function round2(n) {
    return Math.round(n * 100) / 100;
  }
  function ownText(el) {
    var out = '';
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) out += n.textContent;
    }
    return collapse(out);
  }
  function kindOf(el) {
    if (el.matches(LANDMARK)) return 'landmark';
    if (el.matches(HEADING)) return 'heading';
    if (el.matches(LINK)) return 'link';
    if (el.matches(BUTTON)) return 'button';
    if (el.matches(IMAGE)) return 'image';
    if (el.matches(CONTROL)) return 'control';
    return 'text';
  }
  function isTextBlock(el) {
    return el.matches(TEXT) && ownText(el).length >= 2;
  }
  function wanted(el) {
    if (el.matches(NON_TEXT)) return true;
    if (!isTextBlock(el)) return false;
    var inner = el.querySelectorAll(TEXT);
    for (var i = 0; i < inner.length; i++) if (isTextBlock(inner[i])) return false;
    return true;
  }

  function usableId(el) {
    var id = el.getAttribute('id');
    if (!id || !/^[A-Za-z][\w-]*$/.test(id) || /\d{4,}|[a-f0-9]{8,}/.test(id)) return false;
    return document.querySelectorAll('[id="' + id + '"]').length === 1;
  }
  function selectorOf(el) {
    if (usableId(el)) return '#' + el.getAttribute('id');
    var tid = el.getAttribute('data-testid');
    if (tid) return '[data-testid="' + tid.replace(/["\\]/g, '\\$&') + '"]';
    var parts = [];
    var anchor = null;
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement && parts.length < 5) {
      if (cur !== el && usableId(cur)) {
        anchor = '#' + cur.getAttribute('id');
        break;
      }
      var idx = 1;
      for (var s = cur.previousElementSibling; s; s = s.previousElementSibling) {
        if (s.tagName === cur.tagName) idx++;
      }
      parts.unshift(cur.tagName.toLowerCase() + ':nth-of-type(' + idx + ')');
      cur = cur.parentElement;
    }
    if (anchor) parts.unshift(anchor);
    else if (!cur || cur === document.body || cur === document.documentElement) parts.unshift('body');
    return parts.join(' > ');
  }

  function textOf(el) {
    return collapse(el.innerText != null ? el.innerText : el.textContent);
  }
  function nameOf(el, kind) {
    var v = collapse(el.getAttribute('aria-label'));
    if (v) return v.slice(0, 120);
    var by = el.getAttribute('aria-labelledby');
    if (by) {
      v = collapse(by.split(/\s+/).map(function (id) {
        var r = document.getElementById(id);
        return r ? textOf(r) : '';
      }).join(' '));
      if (v) return v.slice(0, 120);
    }
    v = collapse(el.getAttribute('alt'));
    if (v) return v.slice(0, 120);
    var id = el.getAttribute('id');
    if (id) {
      var lab = document.querySelector('label[for="' + id.replace(/["\\]/g, '\\$&') + '"]');
      v = lab ? textOf(lab) : '';
      if (v) return v.slice(0, 120);
    }
    v = collapse(el.getAttribute('title'));
    if (v) return v.slice(0, 120);
    if (kind !== 'control') {
      v = textOf(el);
      if (v) return v.slice(0, 120);
    }
    return '';
  }

  function contained(inner, outer) {
    return inner.left >= outer.left - 1 && inner.top >= outer.top - 1 &&
      inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1;
  }
  function clippedByAncestor(el, rect) {
    for (var a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      var cs = getComputedStyle(a);
      if ((cs.overflowX !== 'visible' || cs.overflowY !== 'visible') && !contained(rect, a.getBoundingClientRect())) return true;
    }
    return false;
  }
  function isShown(cs, rect) {
    return rect.width * rect.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  function record(el, kind, index, parent, clientWidth) {
    var cs = getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    var weight = cs.fontWeight === 'bold' ? 700 : cs.fontWeight === 'normal' ? 400 : num(cs.fontWeight) || 400;
    var flex = cs.display.indexOf('flex') >= 0 || cs.display.indexOf('grid') >= 0;
    var box = {
      x: round2(rect.left + (window.scrollX || 0)),
      y: round2(rect.top + (window.scrollY || 0)),
      w: round2(rect.width),
      h: round2(rect.height)
    };
    var item = { i: index, parent: parent, kind: kind, tag: el.tagName.toLowerCase() };
    var role = el.getAttribute('role') || IMPLICIT_ROLE[item.tag];
    if (role) item.role = role;
    if (kind === 'heading') item.level = Number(item.tag.charAt(1));
    var name = nameOf(el, kind);
    if (name) item.name = name;
    if (kind !== 'control') {
      var text = textOf(el).slice(0, 200);
      if (text) item.text = text;
    }
    item.selector = selectorOf(el);
    item.box = box;
    item.visible = isShown(cs, rect);
    item.style = {
      fontSize: num(cs.fontSize),
      fontWeight: weight,
      lineHeight: cs.lineHeight === 'normal' ? null : num(cs.lineHeight),
      fontFamily: String(cs.fontFamily || '').split(',')[0].replace(/^\s*["']|["']\s*$/g, '').trim(),
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      display: cs.display,
      position: cs.position,
      overflowX: cs.overflowX,
      marginTop: num(cs.marginTop),
      marginBottom: num(cs.marginBottom),
      paddingTop: num(cs.paddingTop),
      paddingBottom: num(cs.paddingBottom),
      gap: flex ? num(cs.columnGap) : null,
      borderRadius: num(cs.borderTopLeftRadius),
      opacity: cs.opacity === '' ? 1 : num(cs.opacity)
    };
    item.flags = {
      beyondViewport: box.x + box.w > clientWidth + 1 || box.x < -1,
      clippedByAncestor: clippedByAncestor(el, rect),
      textClipped: el.scrollWidth > el.clientWidth + 1 && (cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis')
    };
    return item;
  }

  var de = document.documentElement;
  var clientWidth = de.clientWidth;
  var scrollWidth = de.scrollWidth;
  var candidates = document.querySelectorAll(ALL);
  var elements = [];
  var index = new Map();
  var truncated = false;

  for (var c = 0; c < candidates.length; c++) {
    var el = candidates[c];
    if (!wanted(el)) continue;
    var kind = kindOf(el);
    if (kind !== 'landmark' && !isShown(getComputedStyle(el), el.getBoundingClientRect())) continue;
    if (elements.length >= MAX_ELEMENTS) {
      truncated = true;
      break;
    }
    var parent = null;
    for (var p = el.parentElement; p; p = p.parentElement) {
      if (index.has(p)) {
        parent = index.get(p);
        break;
      }
    }
    index.set(el, elements.length);
    elements.push(record(el, kind, elements.length, parent, clientWidth));
  }

  var snapshot = {
    schema: 'conformui.dom-snapshot',
    version: 1,
    snippetVersion: SNIPPET_VERSION,
    page: { url: location.protocol + '//' + location.host + location.pathname, title: String(document.title || '').slice(0, 120) },
    capturedAt: new Date().toISOString(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    dpr: window.devicePixelRatio || 1,
    document: { scrollWidth: scrollWidth, scrollHeight: de.scrollHeight, clientWidth: clientWidth },
    overflow: { horizontal: scrollWidth > clientWidth, horizontalPx: Math.max(0, scrollWidth - clientWidth) },
    elements: elements,
    truncated: truncated
  };

  function bytes(s) {
    return new TextEncoder().encode(s).length;
  }
  var json = JSON.stringify(snapshot);
  if (bytes(json) > MAX_BYTES) {
    snapshot.elements.forEach(function (e) {
      if (e.kind === 'text') delete e.text;
    });
    json = JSON.stringify(snapshot);
    while (bytes(json) > MAX_BYTES && snapshot.elements.length > 1) {
      snapshot.elements.length = Math.floor(snapshot.elements.length / 2);
      snapshot.truncated = true;
      json = JSON.stringify(snapshot);
    }
  }

  if (typeof copy === 'function') copy(json);
  else console.log(json);
  return 'ConformUI snapshot copied: ' + snapshot.elements.length + ' elements, ' + snapshot.viewport.width + '\u00d7' + snapshot.viewport.height;
})();
