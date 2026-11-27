// Records the demo footage by driving a dedicated Chrome profile against the live app.
// Usage: node rec.cjs [--cloud]   (writes work/raw-main.webm, work/raw-mobile.webm, work/rec-log.json)
// Without --cloud the real cloud steps (Deep Analysis send, mobile consent allow) are not clicked.
const fs = require('fs'), path = require('path');
const { launch, root } = require('./chrome.cjs');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'https://conformui.web.app';
const CLOUD = process.argv.includes('--cloud');
const DSF = 1.25, W = 1536, H = 864;
const work = path.join(root, 'work'); fs.mkdirSync(work, { recursive: true });
const log = { events: [], notes: [] };
let T0 = 0; const now = () => (Date.now() - T0) / 1000;
const ev = (o) => { log.events.push({ t: +now().toFixed(2), ...o }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const REPO = process.env.CONFORMUI_REPO || 'C:/Users/SN-LP-64/source/repos/qmamushroof/ConformUI';

const CURSOR = `(() => { if (window.__cur) return; const mk = () => { if (!document.body) return setTimeout(mk, 50);
 const d = document.createElement('div'); d.id='__cur'; d.style.cssText='position:fixed;left:-50px;top:-50px;width:0;height:0;z-index:2147483647;pointer-events:none';
 d.innerHTML='<div id="__ring" style="position:absolute;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%;border:3px solid rgba(255,196,0,.95);background:rgba(255,196,0,.18);transition:transform .15s"></div><svg width="26" height="26" viewBox="0 0 24 24" style="position:absolute;left:-2px;top:-2px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))"><path d="M3 2l15 9-7 1.5L8 20z" fill="#111" stroke="#fff" stroke-width="1.5"/></svg>';
 document.body.appendChild(d); window.__cur=d;
 addEventListener('mousemove', e => { d.style.left=e.clientX+'px'; d.style.top=e.clientY+'px'; }, true);
 addEventListener('mousedown', () => { document.getElementById('__ring').style.transform='scale(.6)'; }, true);
 addEventListener('mouseup', () => { document.getElementById('__ring').style.transform='scale(1)'; }, true); }; mk(); })();`;

async function setup(page) { await page.addInitScript(CURSOR); }
async function moveTo(page, loc, opts = {}) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox(); if (!b) throw new Error('no box');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: opts.steps || 28 });
}
async function click(page, loc, pause = 550) { await moveTo(page, loc); await sleep(pause); await loc.click(); }
async function rect(loc, pad = 14) {
  await loc.scrollIntoViewIfNeeded().catch(() => {}); await sleep(250);
  const b = await loc.boundingBox(); if (!b) return null;
  return [Math.max(0, Math.round((b.x - pad) * DSF)), Math.max(0, Math.round((b.y - pad) * DSF)), Math.round((b.width + 2 * pad) * DSF), Math.round((b.height + 2 * pad) * DSF)];
}
// Logs a zoom cue (time = when the zoom starts) and holds on it.
async function cue(loc, { scale = 1.8, hold = 2.2, pad = 14, box = true, what = '' } = {}) {
  const r = await rect(loc, pad).catch(() => null); if (!r) { log.notes.push('cue missing: ' + what); return; }
  ev({ k: 'cue', rect: r, scale, hold, box, what });
  await sleep((hold + 1.0) * 1000);
}
async function step(name, fn) {
  try { await fn(); } catch (e) { log.notes.push('FAIL ' + name + ': ' + String(e.message).split('\n')[0]); console.log('FAIL', name, e.message.split('\n')[0]); throw e; }
}
async function showMock(page, html) {
  await page.evaluate((h) => { const f = document.createElement('iframe'); f.id = '__mock'; f.srcdoc = h; f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483000;background:#fff'; document.body.appendChild(f); }, html);
}
const hideMock = (page) => page.evaluate(() => document.getElementById('__mock')?.remove());
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Runs the app's real snippet (src/features/dom-snippet/snippet.js) on the flawed sample page at 1440 px.
async function snapshotJson() {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.addInitScript(() => { window.copy = (s) => { window.__copied = s; }; });
  await p.goto('file:///' + REPO + '/sample-site/flawed/index.html'); await p.waitForLoadState('networkidle');
  const code = fs.readFileSync(REPO + '/src/features/dom-snippet/snippet.js', 'utf8');
  const out = await p.evaluate((c) => { const r = (0, eval)(c); return { out: r, json: window.__copied }; }, code);
  await b.close(); return out;
}

(async () => {
  const snap = await snapshotJson(); log.snapshotOutput = snap.out; console.log('snippet:', snap.out);
  const ctx = await launch({ ai: true, width: W, height: H, dsf: DSF });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
  global.__ctxs = [ctx]; global.__pg = null;
  const page = ctx.pages()[0] || await ctx.newPage();
  await setup(page); global.__pg = page;
  await page.goto(APP + '/'); await page.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); for (const d of await indexedDB.databases()) indexedDB.deleteDatabase(d.name); localStorage.clear(); });
  await sleep(800); await page.goto(APP + '/'); await page.waitForLoadState('networkidle'); await sleep(1500);
  log.availability = await page.evaluate(async () => LanguageModel.availability({ expectedInputs: [{ type: 'image' }, { type: 'text' }], expectedOutputs: [{ type: 'text' }] }));
  log.header = await page.evaluate(() => document.querySelector('header')?.innerText);
  await page.mouse.move(700, 300);
  await page.screencast.start({ path: path.join(work, 'raw-main.webm'), size: { width: 1920, height: 1080 }, quality: 95 });
  T0 = Date.now();
  const L = (re) => page.getByText(re).first();

  // ---- Beat 2
  ev({ k: 'beat', n: 2 });
  await page.goto('chrome://on-device-internals'); await sleep(1500);
  await click(page, page.getByText('Broker State').first()); await sleep(1500);
  log.brokerState = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  ev({ k: 'cue', rect: [380, 120, 1160, 600], scale: 1.25, hold: 1.6, box: false, what: 'broker state' }); await sleep(3200);
  await page.goto(APP + '/'); await page.waitForLoadState('networkidle'); await sleep(1500);
  await cue(L(/has left this device/), { scale: 1.8, hold: 1.5, what: 'counter idle' });
  await ctx.setOffline(true); await sleep(1500);
  await cue(page.locator('header').getByText('Offline').first(), { scale: 2, hold: 1.5, what: 'offline pill' });
  await step('try sample', async () => { await click(page, page.getByText('Try the sample').first()); });
  await sleep(2500);
  await step('contract link', async () => { await click(page, page.getByRole('link', { name: 'Contract v1' })); });
  await sleep(1200);
  await step('extract', async () => { await click(page, page.getByRole('button', { name: /Extract contract/ }).first()); });
  ev({ k: 'wait', phase: 'start', label: 'On-device model reading the design' });
  const tx = Date.now();
  for (let i = 0; i < 90; i++) { await sleep(2000); if (/AI extracted \d+ requirements/.test(await page.evaluate(() => document.body.innerText))) break; }
  ev({ k: 'wait', phase: 'end' }); log.extractSeconds = (Date.now() - tx) / 1000;
  await sleep(1000);
  log.aiPanel = await page.evaluate(() => (document.body.innerText.match(/AI proposed[^\n]*/) || [''])[0]);
  await cue(L(/AI extracted \d+ requirements/), { scale: 1.7, hold: 2, what: 'engine badge on-device' });
  await cue(L(/AI proposed \d+ requirements/), { scale: 1.6, hold: 2.2, what: 'AI vs verified' });
  await step('keep verified', async () => { await click(page, page.getByRole('button', { name: /Keep verified contract/ })); });
  await sleep(1500);
  await cue(page.getByText('Inferred', { exact: true }).first(), { scale: 1.8, hold: 1.8, pad: 40, what: 'inferred item' });
  await cue(L(/has left this device/), { scale: 1.8, hold: 1.5, what: 'counter' });

  // ---- Beat 3
  ev({ k: 'beat', n: 3 });
  const img = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/flawed.png')).toString('base64');
  await showMock(page, fs.readFileSync(path.join(root, 'assets/mock-console.html'), 'utf8').replace('__IMG__', img).replace('__OUT__', esc(snap.out)));
  await sleep(1000); ev({ k: 'cue', rect: [60, 640, 1800, 160], scale: 1.5, hold: 2.2, box: false, what: 'console output' }); await sleep(3600);
  await hideMock(page); await sleep(500);
  await page.evaluate((j) => navigator.clipboard.writeText(j), snap.json);
  await step('back to project', async () => { await click(page, page.getByRole('link', { name: /Sample landing page/ }).first()); });
  await sleep(1500);
  await step('paste snapshot', async () => { await click(page, page.getByRole('button', { name: 'Paste snapshot' }).first()); });
  await sleep(700); const ta = page.getByRole('textbox').last(); await moveTo(page, ta); await sleep(400); await ta.click(); await page.keyboard.press('Control+V'); await sleep(1200);
  await step('add snapshot', async () => { await click(page, page.getByRole('button', { name: 'Add snapshot' })); });
  await sleep(1500);
  await step('run', async () => { await click(page, page.getByRole('button', { name: 'Run', exact: true })); });
  ev({ k: 'wait', phase: 'start', label: 'Run: measuring and judging on device' });
  for (let i = 0; i < 60; i++) { await sleep(2000); if (await page.getByRole('button', { name: 'Copy fix prompt' }).count()) break; }
  ev({ k: 'wait', phase: 'end' }); await sleep(1200);
  log.run1Text = await page.evaluate(() => document.body.innerText.slice(0, 3800));
  const items = [/Primary CTA is 132 px/, /Nothing is drawn where the design shows content/, /The headline/, /horizontal overflow/];
  for (const re of items) {
    const it = page.getByText(re).first();
    if (await it.count()) { await moveTo(page, it, { steps: 18 }); await sleep(300); await it.click().catch(() => {}); await sleep(300); await cue(it, { scale: 1.6, hold: 1.8, pad: 30, what: 'finding ' + re }); } else log.notes.push('finding not found ' + re);
  }
  const trace = page.getByText('Engine trace').first();
  await trace.scrollIntoViewIfNeeded(); await sleep(400);
  await cue(trace.locator('xpath=ancestor::*[self::section or self::details][1]'), { scale: 1.3, hold: 2.5, pad: 4, what: 'engine trace' });

  // ---- Beat 4
  ev({ k: 'beat', n: 4 });
  await ctx.setOffline(false); await sleep(1200);
  await page.reload(); await page.waitForLoadState('networkidle'); await sleep(2500);
  await page.evaluate(() => scrollTo(0, 0)); await sleep(500);
  const deepBtn = page.getByRole('button', { name: 'Deep Analysis' });
  const deepOk = await deepBtn.isEnabled().catch(() => false); log.deepEnabled = deepOk;
  if (deepOk) await step('deep', async () => { await click(page, deepBtn); }); else log.notes.push('Deep Analysis button disabled');
  await sleep(1200);
  log.deepSheet = await page.evaluate(() => document.querySelector('[role=dialog]')?.innerText || '');
  const dlg = page.getByRole('dialog');
  if (await dlg.count()) await cue(dlg, { scale: 1.3, hold: 2.2, pad: 0, what: 'send sheet' });
  if (CLOUD && deepOk) {
    await step('send cloud', async () => { await click(page, page.getByRole('button', { name: /Send to cloud/ })); });
    ev({ k: 'wait', phase: 'start', label: 'Cloud request in flight' }); const tc = Date.now();
    for (let i = 0; i < 90; i++) { await sleep(2000); const t = await page.evaluate(() => document.body.innerText); if (/Refined by Cloud|did not finish|Couldn.t reach|nothing to refine|limit reached|took too long|Deep Analysis refined/i.test(t)) break; }
    ev({ k: 'wait', phase: 'end' }); log.cloudSeconds = (Date.now() - tc) / 1000; await sleep(800);
    log.deepResult1 = await page.evaluate(() => document.body.innerText.slice(0, 1500));
    const pre = page.getByRole('button', { name: /Show pre-computed result/ });
    if (await pre.count()) { log.cloudFailed = true; await cue(page.locator('[role=alert]').first(), { scale: 1.5, hold: 1.8, pad: 20, what: 'cloud unreachable notice' }); await click(page, pre); await sleep(1500); }
    log.deepResult = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    const ref = page.getByText(/Refined by Cloud/).first();
    if (await ref.count()) { await cue(ref, { scale: 1.7, hold: 2.2, pad: 30, what: 'refined by cloud' }); }
    const tr = page.getByText('Engine trace').first(); await tr.scrollIntoViewIfNeeded().catch(() => {}); await sleep(400);
    await cue(tr.locator('xpath=ancestor::*[self::section or self::details][1]'), { scale: 1.3, hold: 2.2, pad: 4, what: 'cloud trace' });
  } else { await page.keyboard.press('Escape'); }

  // ---- Beat 5
  ev({ k: 'beat', n: 5 }); await sleep(500);
  await page.evaluate(() => scrollTo(0, 0)); await sleep(400);
  await step('copy prompt', async () => { await click(page, page.getByRole('button', { name: 'Copy fix prompt' })); });
  await sleep(600); await cue(page.getByText('Fix prompt copied').first(), { scale: 1.8, hold: 1.5, what: 'toast' });
  const prompt = await page.evaluate(() => navigator.clipboard.readText()); log.prompt = prompt;
  const code = esc(fs.readFileSync(path.join(root, 'assets/flawed-source.html'), 'utf8').split('\n').slice(0, 40).join('\n'));
  await showMock(page, fs.readFileSync(path.join(root, 'assets/mock-editor.html'), 'utf8').replace('__CODE__', code).replace('__PROMPT__', esc(prompt.slice(0, 1700) + '\n...')));
  await sleep(5500); await hideMock(page); await sleep(500);
  await step('reverify', async () => { await click(page, page.getByRole('button', { name: /Re-verify/ }).first()); });
  await sleep(1200);
  await step('load fixed', async () => { await click(page, page.getByRole('button', { name: 'Load fixed implementation' })); });
  await sleep(1500);
  await step('run reverify', async () => { await click(page, page.getByRole('button', { name: 'Run Re-verify' })); });
  ev({ k: 'wait', phase: 'start', label: 'Re-verify' });
  for (let i = 0; i < 60; i++) { await sleep(2000); const t = await page.evaluate(() => document.body.innerText); if (/Re-verify complete/.test(t)) break; }
  ev({ k: 'wait', phase: 'end' }); await sleep(1000);

  // ---- Beat 6
  ev({ k: 'beat', n: 6 });
  log.reverifyText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  await page.evaluate(() => scrollTo(0, 0)); await sleep(500);
  ev({ k: 'cue', rect: [70, 320, 900, 80], scale: 1.9, hold: 2.5, box: true, what: 'summary resolved/remaining' }); await sleep(3500);
  const rem = page.getByRole('listitem').filter({ hasText: /vertical gap/ }).first();
  if (await rem.count()) { await click(page, rem); await sleep(800); await cue(rem, { scale: 1.45, hold: 2, pad: 8, what: 'remaining finding' }); }
  await step('diff overlay', async () => { await click(page, page.getByRole('button', { name: /Diff overlay/ })); });
  await sleep(1000);
  await cue(page.getByText('Evidence').first().locator('xpath=ancestor::section[1]'), { scale: 1.0, hold: 3, pad: 0, box: false, what: 'diff hold' });

  // ---- Beat 7 (export)
  ev({ k: 'beat', n: 7 });
  await page.evaluate(() => scrollTo(0, 0)); await sleep(500);
  await step('menu', async () => { await click(page, page.getByRole('button', { name: /More run actions/ })); });
  await sleep(600);
  await step('export', async () => { await click(page, page.getByText('Export report').first()); });
  await sleep(1200); log.exportDialog = await page.evaluate(() => document.querySelector('[role=dialog]')?.innerText || document.body.innerText.slice(0, 300));
  const md = page.getByText(/Markdown/).first();
  if (await md.count()) { await click(page, md).catch(() => {}); await sleep(900); }
  const dl = page.getByRole('button', { name: /Download/ }).first();
  if (await dl.count()) { await click(page, dl); await sleep(1500); await cue(page.getByText(/Downloaded/).first(), { scale: 1.8, hold: 1.5, what: 'downloaded' }); }
  await page.keyboard.press('Escape').catch(() => {}); await page.evaluate(() => scrollTo(0, 0)); await sleep(500);
  await cue(page.getByText('Install app').first(), { scale: 2.2, hold: 1.8, pad: 16, what: 'install app' });
  ev({ k: 'end' });
  await page.screencast.stop(); await ctx.close();

  // ---- Beat 7 (mobile, no on-device model)
  const mob = await launch({ ai: false, width: 390, height: 844, dsf: 2, mobile: true });
  global.__ctxs = [mob];
  const mp = mob.pages()[0] || await mob.newPage();
  await setup(mp);
  await mp.goto(APP + '/'); await mp.evaluate(async () => { for (const d of await indexedDB.databases()) indexedDB.deleteDatabase(d.name); localStorage.clear(); });
  await sleep(800); await mp.goto(APP + '/'); await mp.waitForLoadState('networkidle'); await sleep(1500);
  log.mobileHeader = await mp.evaluate(() => document.querySelector('header')?.innerText);
  await mp.screencast.start({ path: path.join(work, 'raw-mobile.webm'), size: { width: 780, height: 1688 }, quality: 95 });
  const M0 = Date.now(); const mev = (o) => log.events.push({ mobile: true, t: +((Date.now() - M0) / 1000).toFixed(2), ...o });
  await sleep(800); await mp.mouse.move(200, 400, { steps: 10 });
  await click(mp, mp.getByText('Try the sample').first()); await sleep(2500);
  await click(mp, mp.getByRole('link', { name: 'Contract v1' })); await sleep(1200);
  await click(mp, mp.getByRole('button', { name: /Extract contract/ }).first()); await sleep(1500);
  log.mobileConsent = await mp.evaluate(() => document.querySelector('[role=dialog]')?.innerText || document.body.innerText.slice(0, 600));
  mev({ k: 'consent' }); await sleep(2500);
  if (CLOUD) {
    await click(mp, mp.getByRole('button', { name: /Allow for this project/ }));
    mev({ k: 'wait', phase: 'start', label: 'Cloud reading the design' }); const tm = Date.now();
    for (let i = 0; i < 70; i++) { await sleep(2000); const t = await mp.evaluate(() => document.body.innerText); if (/AI extracted \d+|could not finish|Couldn.t reach|limit/i.test(t)) break; }
    mev({ k: 'wait', phase: 'end' }); log.mobileCloudSeconds = (Date.now() - tm) / 1000; await sleep(1000);
    log.mobileResult = await mp.evaluate(() => document.body.innerText.slice(0, 1500));
    await mp.getByText(/AI extracted \d+/).first().scrollIntoViewIfNeeded().catch(() => {}); await sleep(2500);
  }
  mev({ k: 'end' }); await mp.screencast.stop(); await mob.close();
  fs.writeFileSync(path.join(work, 'rec-log.json'), JSON.stringify(log, null, 2));
  console.log('done', JSON.stringify({ extract: log.extractSeconds, cloud: log.cloudSeconds, ai: log.aiPanel, notes: log.notes, avail: log.availability, mobileHeader: log.mobileHeader }));
})().catch(async (e) => { try { await global.__pg?.screencast.stop(); } catch {} try { for (const c of global.__ctxs || []) await c.close(); } catch {} fs.writeFileSync(path.join(work, 'rec-log.json'), JSON.stringify(log, null, 2)); console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
