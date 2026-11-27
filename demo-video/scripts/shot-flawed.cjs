// Screenshot the flawed sample page at 1440px from the app repo (read-only) and report the CTA rect.
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const repo = process.env.CONFORMUI_REPO || 'C:/Users/SN-LP-64/source/repos/qmamushroof/ConformUI';
const out = path.resolve(__dirname, '..', 'assets');
(async () => {
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(pathToFileURL(path.join(repo, 'sample-site/flawed/index.html')).href);
await p.waitForLoadState('networkidle');
await p.screenshot({ path: path.join(out, 'flawed.png'), fullPage: true });
const r = await p.evaluate(() => { const e = document.querySelector('main a.btn, main .btn, .hero a'); const q = e.getBoundingClientRect(); return {x:q.x,y:q.y,w:q.width,h:q.height,t:e.textContent}; });
console.log(JSON.stringify(r));
await b.close();
})();
