// Sample capture (SPEC-DEMO-07). Usage: node scripts/capture-sample.mjs [outDir]
// Renders sample-site/ pages with Playwright Chromium, runs the DOM snippet, writes PNGs, snapshots and a SHA-256 list.
// Pages are served from disk under a fixed fake origin so outputs are deterministic and hold no local paths.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const siteDir = join(root, 'sample-site');
const outDir = resolve(process.argv[2] ?? join(root, 'src/features/demo/sample'));
const snippet = readFileSync(join(root, 'src/features/dom-snippet/snippet.js'), 'utf8');

const ORIGIN = 'https://sample.test';
const FIXED_TIME = '2026-01-01T00:00:00.000Z';
const HEIGHT = 900;
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};

// [output name, page path, viewport width, deviceScaleFactor, snapshot?]
const JOBS = [
  ['design-desktop', '/design.html', 1440, 2, false],
  ['flawed-desktop', '/flawed/', 1440, 1, true],
  ['flawed-mobile', '/flawed/', 390, 1, true],
  ['fixed-desktop', '/fixed/', 1440, 1, true],
  ['fixed-mobile', '/fixed/', 390, 1, true],
];

const sha = (b) => createHash('sha256').update(b).digest('hex');

function fileFor(pathname) {
  let p = decodeURIComponent(pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = resolve(siteDir, `.${p}`);
  return file.startsWith(siteDir + sep) ? file : null;
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const written = [];
let blocked = 0;
try {
  for (const [name, path, width, dpr, withDom] of JOBS) {
    const context = await browser.newContext({ viewport: { width, height: HEIGHT }, deviceScaleFactor: dpr });
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      let file = null;
      if (url.origin === ORIGIN) {
        file = fileFor(url.pathname);
        try {
          if (file)
            return route.fulfill({
              body: readFileSync(file),
              contentType: MIME[extname(file)] ?? 'application/octet-stream',
            });
        } catch {
          // fall through to abort
        }
      }
      blocked += 1;
      process.stderr.write(`blocked request: ${url.origin}${url.pathname}\n`);
      return route.abort();
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(FIXED_TIME);
    await page.goto(ORIGIN + path, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const image = await page.screenshot({
      type: 'png',
      fullPage: true,
      clip: { x: 0, y: 0, width, height: scrollHeight },
    });
    const files = [[`${name}.png`, image]];
    if (withDom) {
      const json =
        await page.evaluate(`(() => { var out; var prev = window.copy; window.copy = function (t) { out = t; };
        try { ${snippet.replace(/<\/script>/g, '')}\n } finally { window.copy = prev; } return out; })()`);
      if (typeof json !== 'string') throw new Error(`${name}: snippet did not call copy()`);
      files.push([`${name}.dom.json`, Buffer.from(`${JSON.stringify(JSON.parse(json))}\n`)]);
    }
    for (const [file, body] of files) {
      writeFileSync(join(outDir, file), body);
      written.push([file, body]);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
if (blocked > 0) {
  console.error(`capture-sample: ${blocked} request(s) outside ${ORIGIN} were blocked; fix the page`);
  process.exit(1);
}

// Snapshots are formatted with the repo's Biome config (via stdin) so they pass `biome ci` and stay byte-stable.
const biome = join(root, 'node_modules/@biomejs/biome/bin/biome');
for (const w of written) {
  if (!w[0].endsWith('.json')) continue;
  w[1] = execFileSync(process.execPath, [biome, 'format', `--stdin-file-path=${w[0]}`], { cwd: root, input: w[1] });
  writeFileSync(join(outDir, w[0]), w[1]);
}

written.sort((a, b) => (a[0] < b[0] ? -1 : 1));
const list = `${written.map(([f, b]) => `${sha(b)}  ${f}`).join('\n')}\n`;
writeFileSync(join(outDir, 'SHA256SUMS.txt'), list);
process.stdout.write(list);
