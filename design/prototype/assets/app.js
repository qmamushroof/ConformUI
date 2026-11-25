/* ConformUI prototype behaviour (vanilla). Shared by every screen.
   Page contract:
   <body data-nav="projects|snippet|settings" data-states="default,empty,loading,error" data-title="...">
   <header data-shell></header>                      → app header
   <div data-phead data-step="design|contract|captures|run|fix|reverify"></div> → project header + steps
   Elements with data-state-show="a b" are visible only in those states (default = "default").
   data-open="dialogId" opens a <dialog class="sheet">; [data-close] closes it.
   data-toast="text" shows a toast; data-copy="text" copies + toasts.
   data-menu on a button toggles its next .menu sibling.
   data-press toggles aria-pressed; data-press-target="#id" + data-press-class="x" toggles a class.
   [role=tablist] with [role=tab][aria-controls] switches panels.
   [role=listbox] supports Up/Down/Home/End; options with data-href navigate on Enter/click. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('cui-' + k); return v === null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('cui-' + k, v); } catch (e) {} }
  };
  var params = new URLSearchParams(location.search);

  /* Theme */
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  applyTheme(store.get('theme', 'system'));

  /* Global demo state */
  var offline = params.get('offline') === '1' || store.get('offline', '0') === '1';
  var engine = params.get('engine') || store.get('engine', 'ready'); // ready|downloadable|downloading|flag|unavailable
  var sent = store.get('sent', '0') === '1';

  var ENGINE = {
    ready: { icon: 'chip', text: 'On-device ready' },
    downloadable: { icon: 'chip', text: 'Model not downloaded', off: true },
    downloading: { icon: 'chip', text: 'Downloading 42%', off: true },
    flag: { icon: 'chip', text: 'On-device off', off: true },
    unavailable: { icon: 'cloud', text: 'Cloud with consent', off: true }
  };
  function ic(name, cls) { return '<svg class="i ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  window.cuiIcon = ic;

  /* Shell */
  function renderShell() {
    var h = $('[data-shell]'); if (!h) return;
    var nav = document.body.dataset.nav || '';
    var e = ENGINE[engine] || ENGINE.ready;
    var privacy = sent ? 'Cloud: 1 request · 412 KB' : 'Nothing has left this device';
    h.className = 'hdr';
    h.innerHTML =
      '<a class="brand" href="projects.html" aria-label="ConformUI, projects"><svg aria-hidden="true" style="color:var(--accent)"><use href="#logo"/></svg>ConformUI</a>' +
      '<nav class="nav" aria-label="Main">' +
      ['projects:Projects', 'snippet:Snippet', 'settings:Settings'].map(function (p) {
        var k = p.split(':'); return '<a href="' + k[0] + '.html"' + (nav === k[0] ? ' aria-current="page"' : '') + '>' + k[1] + '</a>';
      }).join('') + '</nav>' +
      '<div class="hdr-status">' +
      (offline ? '<span class="offline" role="status">' + ic('offline', 'i-sm') + 'Offline</span>' : '') +
      '<a class="status-link" href="settings.html#engine" aria-label="Engine: ' + e.text + '. Open engine settings">' + ic(e.icon, 'i-sm') + '<span class="lbl">' + e.text + '</span></a>' +
      '<a class="status-link" href="' + (document.body.dataset.trace || 'settings.html#privacy') + '" aria-label="Privacy: ' + privacy + '">' + ic('shield', 'i-sm') + '<span class="lbl">' + privacy + '</span></a>' +
      '<button class="iconbtn menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="mnav">' + ic('menu') + '</button>' +
      '</div>';
    var mn = document.createElement('nav');
    mn.id = 'mnav'; mn.className = 'mobile-nav'; mn.setAttribute('aria-label', 'Main');
    mn.innerHTML = '<a href="projects.html">Projects</a><a href="snippet.html">Snippet</a><a href="settings.html">Settings</a>';
    h.after(mn);
    var mb = $('.menu-btn', h);
    mb.addEventListener('click', function () { var o = mn.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
    if (!$('.skip')) h.insertAdjacentHTML('beforebegin', '<a class="skip" href="#main">Skip to content</a>');
  }

  var STEPS = [
    ['design', 'Design', 'project.html'], ['contract', 'Contract', 'contract.html'], ['captures', 'Captures', 'project.html#captures'],
    ['run', 'Run', 'run.html'], ['fix', 'Fix', 'run.html#fix'], ['reverify', 'Re-verify', 'run.html?reverify=1']
  ];
  function renderPhead() {
    var p = $('[data-phead]'); if (!p) return;
    var cur = p.dataset.step, done = +(p.dataset.done || 0), next = p.dataset.next;
    var name = p.dataset.name || 'Sample landing page', sample = p.dataset.sample !== 'false';
    p.className = 'phead';
    p.innerHTML =
      '<div class="crumbs"><a href="projects.html">Projects</a><span class="sep" aria-hidden="true">/</span><a href="project.html">' + name + '</a>' +
      (sample ? '<span class="tag">Sample</span>' : '') + (p.dataset.crumb ? '<span class="sep" aria-hidden="true">/</span><span>' + p.dataset.crumb + '</span>' : '') + '</div>' +
      '<ol class="steps" aria-label="Project steps" data-progress="Step ' + (Math.max(0, STEPS.findIndex(function (s) { return s[0] === cur; })) + 1) + ' of 6:">' + STEPS.map(function (s, k) {
        var isDone = k < done, isCur = s[0] === cur, isNext = s[0] === next;
        return '<li class="' + (isDone ? 'done' : '') + (isNext ? ' next' : '') + '"><a href="' + s[2] + '"' + (isCur ? ' aria-current="step"' : '') + '>' +
          '<span class="n" aria-hidden="true">' + (isDone ? ic('check') : (k + 1)) + '</span><span class="lbl">' + s[1] + (isNext ? ', next' : '') + '</span>' +
          (isDone ? '<span class="sr-only"> (done)</span>' : '') + '</a></li>';
      }).join('') + '</ol>';
    var c = p.querySelector('.next a, [aria-current="step"]'); if (c && c.scrollIntoView) setTimeout(function () { var ol = p.querySelector('.steps'); ol.scrollLeft = c.offsetLeft - 16; }, 0);
  }

  /* States */
  var state = params.get('state') || 'default';
  function applyState(s) {
    state = s;
    $$('[data-state-show]').forEach(function (el) {
      var on = el.dataset.stateShow.split(/\s+/).indexOf(s) > -1;
      el.hidden = !on;
    });
    document.body.dataset.state = s;
    document.dispatchEvent(new CustomEvent('cui:state', { detail: s }));
  }

  function devbar() {
    var states = (document.body.dataset.states || 'default').split(',');
    var d = document.createElement('div');
    d.className = 'devbar'; d.setAttribute('aria-label', 'Prototype controls');
    d.innerHTML = '<span class="lbl">State</span><select aria-label="Screen state">' + states.map(function (s) { return '<option' + (s === state ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
      '<select aria-label="Theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>' +
      '<button type="button" aria-pressed="' + offline + '">Offline</button>' +
      '<a href="index.html" style="display:inline-flex;align-items:center;min-height:32px;padding:0 8px;color:var(--text-muted)">Map</a>';
    document.body.appendChild(d);
    var sel = d.querySelectorAll('select');
    sel[0].onchange = function () { applyState(this.value); var u = new URL(location); u.searchParams.set('state', this.value); history.replaceState(null, '', u); };
    sel[1].value = store.get('theme', 'system');
    sel[1].onchange = function () { store.set('theme', this.value); applyTheme(this.value); };
    d.querySelector('button').onclick = function () { store.set('offline', offline ? '0' : '1'); location.reload(); };
  }

  /* Toasts */
  var toasts = null;
  function ensureToasts() { if (!toasts) { toasts = document.createElement('div'); toasts.className = 'toasts'; toasts.setAttribute('role', 'status'); toasts.setAttribute('aria-live', 'polite'); document.body.appendChild(toasts); } }
  function toast(t) {
    ensureToasts();
    var el = document.createElement('div'); el.className = 'toast'; el.innerHTML = ic('check', 'i-sm') + '<span></span>'; el.lastChild.textContent = t;
    toasts.appendChild(el); setTimeout(function () { el.remove(); }, 2600);
  }
  window.cuiToast = toast;

  /* Dialogs */
  var lastTrigger = null;
  function openDialog(id, trigger) {
    var d = document.getElementById(id); if (!d) return;
    lastTrigger = trigger || document.activeElement;
    d.showModal();
    var f = d.querySelector('[autofocus]') || d.querySelector('[data-default-focus]');
    if (f) f.focus();
  }
  window.cuiOpen = openDialog;

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open]');
    if (t) { e.preventDefault(); openDialog(t.dataset.open, t); return; }
    t = e.target.closest('[data-close]');
    if (t) { var d = t.closest('dialog'); d.close(t.dataset.close || ''); return; }
    t = e.target.closest('[data-copy]');
    if (t) { try { navigator.clipboard.writeText(t.dataset.copy); } catch (er) {} toast(t.dataset.copyToast || 'Copied'); }
    else if ((t = e.target.closest('[data-toast]'))) { toast(t.dataset.toast); }
    t = e.target.closest('[data-menu]');
    if (t) {
      var m = t.nextElementSibling, open = m.hidden;
      $$('.menu').forEach(function (x) { x.hidden = true; }); $$('[data-menu]').forEach(function (x) { x.setAttribute('aria-expanded', 'false'); });
      m.hidden = !open; t.setAttribute('aria-expanded', open);
      if (open) { var first = m.querySelector('button,a'); if (first) first.focus(); }
      return;
    }
    if (!e.target.closest('.menu')) { $$('.menu').forEach(function (x) { x.hidden = true; }); $$('[data-menu]').forEach(function (x) { x.setAttribute('aria-expanded', 'false'); }); }
    else if (e.target.closest('.menu button, .menu a')) { var mm = e.target.closest('.menu'); mm.hidden = true; }
    t = e.target.closest('[data-press]');
    if (t) {
      var on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', on);
      if (t.dataset.pressTarget) { var tg = $(t.dataset.pressTarget); if (tg) tg.classList.toggle(t.dataset.pressClass, on); }
      if (t.dataset.pressNote) { var n = $(t.dataset.pressNote); if (n) n.textContent = on ? n.dataset.on : n.dataset.off; }
    }
    t = e.target.closest('[role="tab"]');
    if (t && t.closest('[role="tablist"]')) selectTab(t);
    t = e.target.closest('[role="option"]');
    if (t) selectOption(t, true);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var m = $$('.menu').filter(function (x) { return !x.hidden; })[0];
      if (m) { m.hidden = true; var b = m.previousElementSibling; b.setAttribute('aria-expanded', 'false'); b.focus(); }
    }
    var tl = e.target.closest && e.target.closest('[role="tablist"]');
    if (tl && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      var tabs = $$('[role="tab"]', tl), i = tabs.indexOf(e.target.closest('[role="tab"]'));
      var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; n.focus(); selectTab(n); e.preventDefault();
    }
    var lb = e.target.closest && e.target.closest('[role="listbox"]');
    if (lb && ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].indexOf(e.key) > -1) {
      var opts = $$('[role="option"]', lb).filter(function (o) { return o.offsetParent !== null; });
      var cur = opts.indexOf($('#' + lb.getAttribute('aria-activedescendant'))) ;
      var nx = cur;
      if (e.key === 'ArrowDown') nx = Math.min(opts.length - 1, cur + 1);
      if (e.key === 'ArrowUp') nx = Math.max(0, cur - 1);
      if (e.key === 'Home') nx = 0;
      if (e.key === 'End') nx = opts.length - 1;
      if (opts[nx]) selectOption(opts[nx], e.key === 'Enter' || e.key === ' ');
      e.preventDefault();
    }
  });
  document.addEventListener('close', function (e) {
    if (e.target.tagName === 'DIALOG' && lastTrigger) { lastTrigger.focus(); }
  }, true);

  function selectTab(t) {
    var tl = t.closest('[role="tablist"]');
    $$('[role="tab"]', tl).forEach(function (x) {
      var on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
      var p = x.getAttribute('aria-controls'); if (p) { var el = document.getElementById(p); if (el) el.hidden = !on; }
    });
    tl.dispatchEvent(new CustomEvent('cui:tab', { detail: t, bubbles: true }));
  }
  function selectOption(o, activate) {
    var lb = o.closest('[role="listbox"]');
    $$('[role="option"]', lb).forEach(function (x) { x.setAttribute('aria-selected', x === o); });
    if (o.id) lb.setAttribute('aria-activedescendant', o.id);
    o.scrollIntoView({ block: 'nearest' });
    lb.dispatchEvent(new CustomEvent('cui:select', { detail: { option: o, activate: activate }, bubbles: true }));
  }

  /* Drop zones: click opens picker (simulated) */
  document.addEventListener('dragover', function (e) { var d = e.target.closest('.drop'); if (d) { e.preventDefault(); d.classList.add('is-over'); } });
  document.addEventListener('dragleave', function (e) { var d = e.target.closest('.drop'); if (d) d.classList.remove('is-over'); });

  window.cuiStore = store;
  window.cuiState = function () { return state; };
  window.cuiApplyState = applyState;
  window.cuiFlags = { offline: offline, engine: engine, sent: sent };

  function init() {
    renderShell(); renderPhead(); ensureToasts(); devbar(); applyState(state);
    if (document.body.dataset.title) document.title = document.body.dataset.title + ' · ConformUI';
    $$('[role="tablist"]').forEach(function (tl) { $$('[role="tab"]', tl).forEach(function (t) { t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1; }); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
