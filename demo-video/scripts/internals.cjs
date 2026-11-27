// Enables chrome debug pages in the dedicated profile and opens chrome://on-device-internals (Model Status).
const { launch, root } = require('./chrome.cjs');
(async () => {
  const ctx = await launch({ ai: true, width: 1536, height: 864, dsf: 1.25 });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('chrome://chrome-urls');
  await page.waitForTimeout(1000);
  console.log((await page.evaluate(() => document.body.innerText)).slice(0, 400));
  const b = page.getByRole('button').first(); console.log('btn', await b.innerText().catch(() => '?'));
  await b.click().catch((e) => console.log('click fail', e.message.split('\n')[0]));
  await page.goto('chrome://on-device-internals'); await page.waitForTimeout(3000);
  console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1500));
  await page.screenshot({ path: root + '/work/internals.png' });
  await ctx.close();
})().catch(e => { console.error(e.message); process.exit(1); });
