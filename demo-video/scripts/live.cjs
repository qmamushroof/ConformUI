// STEP 1 diagnostic: full live flow against production with the real on-device model. Not used for footage.
// Writes work/live-debug.log (console "[ConformUI AI]" lines) and work/live-metrics.json.
const fs = require('fs'), path = require('path');
const { launch, root } = require('./chrome.cjs');
const APP = process.env.APP_URL || 'https://conformui.web.app';
const work = path.join(root, 'work');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const M = { notes: [] };
const dbg = [];
const body = (p) => p.evaluate(() => document.body.innerText);
const save = () => { fs.writeFileSync(path.join(work, 'live-metrics.json'), JSON.stringify(M, null, 2)); fs.writeFileSync(path.join(work, 'live-debug.log'), dbg.join('\n')); };

(async () => {
  const ctx = await launch({ ai: true, width: 1536, height: 864, dsf: 1.25 });
  global.__ctx = ctx;
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
  await ctx.addInitScript(() => { try { localStorage.setItem('cui.debug.ai', '1'); } catch {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('console', async (m) => {
    const t = m.text();
    if (!t.startsWith('[ConformUI AI]')) return;
    let s = t;
    try { const a = await Promise.all(m.args().map(h => h.jsonValue().catch(() => '?'))); s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); } catch {}
    dbg.push(new Date().toISOString() + ' ' + s);
  });
  M.responses = [];
  page.on('response', (r) => { const u = r.url(); if (/firebase|googleapis|recaptcha|appcheck/i.test(u) && !r.ok()) M.responses.push(r.status() + ' ' + u.slice(0, 160)); });
  await page.goto(APP + '/');
  // make sure the newest deployed build runs (drop the service worker + caches a previous visit left in this profile)
  await page.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); });
  await page.reload(); await sleep(2500);
  M.buildScripts = await page.evaluate(() => [...document.scripts].map(x => x.src.split('/').pop()).join(','));
  M.availability = await page.evaluate(async () => LanguageModel.availability({ expectedInputs: [{ type: 'image' }, { type: 'text' }], expectedOutputs: [{ type: 'text' }] }));
  // 1. Settings > Clear all data
  await page.locator('header').getByRole('link', { name: 'Settings' }).first().click(); await sleep(1500);
  M.settingsText = (await body(page)).slice(0, 1800);
  try {
    await page.getByRole('button', { name: /Clear all data/ }).click(); await sleep(800);
    const conf = page.getByRole('dialog').getByRole('button', { name: /Clear|Delete|Yes|Confirm/ }).last();
    if (await conf.count()) await conf.click(); await sleep(2000); M.clearedVia = 'Settings UI';
  } catch (e) { M.notes.push('settings clear failed: ' + e.message.split('\n')[0]); }
  await page.goto(APP + '/'); await sleep(1500);
  if (!(await page.getByText('Try the sample').count())) { await page.evaluate(async () => { for (const d of await indexedDB.databases()) indexedDB.deleteDatabase(d.name); }); M.clearedVia = 'indexedDB'; await page.goto(APP + '/'); await sleep(1500); }
  M.headerStart = (await body(page)).slice(0, 200).replace(/\n/g, ' | ');

  // 2. Try the sample > Extract contract (on-device)
  await page.getByText('Try the sample').first().click(); await sleep(2500);
  await page.getByRole('link', { name: 'Contract v1' }).click(); await sleep(1500);
  await page.getByRole('button', { name: /Extract contract/ }).first().click();
  const t0 = Date.now();
  for (let i = 0; i < 120; i++) { await sleep(2000); const t = await body(page); if (/AI extracted \d+ requirements|could not finish|took too long/i.test(t)) break; }
  M.extractSeconds = (Date.now() - t0) / 1000;
  const ex = await body(page); M.extractText = ex.slice(0, 5000);
  M.aiPanel = (ex.match(/AI extracted[^\n]*/) || [''])[0]; M.aiVsVerified = (ex.match(/AI proposed[^\n]*/) || [''])[0];
  M.matchedRows = (ex.match(/Matched\s+\d+[\s\S]{0,200}/) || [''])[0];
  await page.screenshot({ timeout: 8000, path: path.join(work, 'live-extract.png') }).catch(() => {});
  save();
  // accept all feedback
  const acc = page.getByRole('button', { name: 'Accept all' });
  if (await acc.count()) { await acc.click(); await sleep(1000); M.acceptAllText = (await body(page)).match(/[^\n]*accepted[^\n]*/g)?.slice(0, 4); }
  // 3. keep the verified contract (the one the sample runs lock) and run
  await page.getByRole('button', { name: /Keep verified contract/ }).click().catch(() => M.notes.push('no keep verified button')); await sleep(1500);
  await page.getByRole('link', { name: /Sample landing page/ }).first().click(); await sleep(1500);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  const r0 = Date.now();
  for (let i = 0; i < 200; i++) { await sleep(1500); if (await page.getByRole('button', { name: 'Copy fix prompt' }).count()) break; }
  M.runSeconds = (Date.now() - r0) / 1000; await sleep(1000);
  const run1 = await body(page); M.run1Text = run1; fs.writeFileSync(path.join(work, 'live-run1.txt'), run1);
  M.run1Summary = (run1.match(/\d+\s*\n\s*fail[\s\S]{0,60}/) || [''])[0].replace(/\n/g, ' ');
  M.run1Trace = (run1.match(/Engine trace[\s\S]*$/) || [''])[0].replace(/\n+/g, ' | ').slice(0, 900);
  M.run1R07 = (run1.match(/[^\n]*(R-07|colour|color)[^\n]*/gi) || []).slice(0, 6);
  await page.screenshot({ timeout: 8000, path: path.join(work, 'live-run1.png') }).catch(() => {}); save();
  // 4. Deep Analysis (cloud, max 2 attempts)
  const deep = page.getByRole('button', { name: 'Deep Analysis' });
  M.deepEnabled = await deep.isEnabled().catch(() => false);
  M.deepAttempts = [];
  if (M.deepEnabled) {
    for (let a = 0; a < 2; a++) {
      await deep.click(); await sleep(1200);
      M.deepSheet = await page.evaluate(() => document.querySelector('[role=dialog]')?.innerText || '');
      await page.getByRole('button', { name: /Send to cloud/ }).click();
      const c0 = Date.now(); let t = '';
      for (let i = 0; i < 70; i++) { await sleep(2000); t = await body(page); if (/Refined by Cloud|did not finish|Couldn.t reach|nothing to refine|limit reached|took too long|Deep Analysis refined/i.test(t)) break; }
      const ok = /Refined by Cloud|Deep Analysis refined|nothing to refine/i.test(t);
      M.deepAttempts.push({ seconds: (Date.now() - c0) / 1000, ok, notice: (t.match(/Deep Analysis[^\n]*|Couldn.t reach[^\n]*|did not finish[^\n]*|limit reached[^\n]*/g) || []).slice(0, 4) });
      M.deepResultText = t.slice(0, 3500);
      if (ok) break; await sleep(3000);
    }
    await page.screenshot({ timeout: 8000, path: path.join(work, 'live-deep.png') }).catch(() => {});
  } else M.deepDisabledReason = (run1.match(/Deep Analysis\n[^\n]*\n?[^\n]*/) || [''])[0].replace(/\n+/g, ' | ');
  M.appCheck403 = M.responses.some(x => x.startsWith('403')); save();
  // 5. Re-verify against fixed
  await page.evaluate(() => scrollTo(0, 0));
  await page.getByRole('button', { name: /Re-verify/ }).first().click(); await sleep(1200);
  await page.getByRole('button', { name: 'Load fixed implementation' }).click(); await sleep(1500);
  await page.getByRole('button', { name: 'Run Re-verify' }).click();
  for (let i = 0; i < 200; i++) { await sleep(1500); if (/Re-verify complete/.test(await body(page))) break; }
  await sleep(1000);
  const rv = await body(page); fs.writeFileSync(path.join(work, 'live-reverify.txt'), rv);
  M.reverifyText = (rv.match(/Re-verify complete[^\n]*/) || [''])[0];
  M.reverifySummary = (rv.match(/\d+\s*\n\s*resolved[\s\S]{0,80}/) || [''])[0].replace(/\n/g, ' ');
  M.reverifyTrace = (rv.match(/Engine trace[\s\S]*?Runs/) || [''])[0].replace(/\n+/g, ' | ').slice(0, 900);
  M.reverifyR07 = (rv.match(/[^\n]*(R-07|colour|color)[^\n]*/gi) || []).slice(0, 6);
  await page.screenshot({ timeout: 8000, path: path.join(work, 'live-reverify.png') }).catch(() => {}); save();
  if (process.env.SKIP_OFFLINE) { await ctx.close(); return; }
  // network-off extract + run
  await ctx.setOffline(true); await sleep(1000);
  await page.goto(APP + '/').catch(() => {}); await sleep(2500);
  M.offlineHeader = (await body(page)).slice(0, 160).replace(/\n/g, ' | ');
  try {
    const ts = page.getByText('Try the sample').first();
    if (!(await ts.count())) { await page.getByRole('link', { name: 'Projects' }).click(); await sleep(1500); }
    await page.getByText('Try the sample').first().click(); await sleep(2500);
    await page.getByRole('link', { name: 'Contract v1' }).click(); await sleep(1500);
    await page.getByRole('button', { name: /Extract contract/ }).first().click();
    const o0 = Date.now();
    for (let i = 0; i < 120; i++) { await sleep(2000); if (/AI extracted \d+ requirements|could not finish|took too long|pre-computed|Pre-computed/i.test(await body(page))) break; }
    M.offlineExtractSeconds = (Date.now() - o0) / 1000;
    const ot = await body(page); M.offlineExtract = (ot.match(/AI extracted[^\n]*|AI proposed[^\n]*|[^\n]*Pre-computed[^\n]*/g) || []).slice(0, 4);
    await page.getByRole('button', { name: /Keep verified contract/ }).click().catch(() => {}); await sleep(1200);
    await page.getByRole('link', { name: /Sample landing page/ }).first().click(); await sleep(1500);
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    for (let i = 0; i < 90; i++) { await sleep(1500); if (await page.getByRole('button', { name: 'Copy fix prompt' }).count()) break; }
    const ort = await body(page); M.offlineRunSummary = (ort.match(/\d+\s*\n\s*fail[\s\S]{0,60}/) || [''])[0].replace(/\n/g, ' ');
    M.offlineRunTrace = (ort.match(/Engine trace[\s\S]*$/) || [''])[0].replace(/\n+/g, ' | ').slice(0, 700);
    M.offlineWorks = /Run complete/.test(ort);
  } catch (e) { M.notes.push('offline flow failed: ' + e.message.split('\n')[0]); M.offlineWorks = false; }
  M.failedResponses = M.responses; save();
  await ctx.close();
  console.log(JSON.stringify({ avail: M.availability, extract: M.extractSeconds, ai: M.aiVsVerified, run: M.run1Summary, rv: M.reverifySummary, deep: M.deepAttempts, off: M.offlineWorks, notes: M.notes }, null, 1));
})().catch(async (e) => { M.notes.push('FATAL ' + e.message.split('\n')[0]); try { save(); await global.__ctx?.close(); } catch {} console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
