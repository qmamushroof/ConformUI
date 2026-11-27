import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { expect, test } from './fixtures';

// ROADMAP 14.2, SPEC §7.5 E7, SPEC-SNIP-07 runtime (PRD-F-13): the snippet on the flawed sample at 390 px.

const ROOT = join(process.cwd(), 'sample-site');
const SNIPPET = readFileSync(join(process.cwd(), 'src/features/dom-snippet/snippet.js'), 'utf8');
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};
const SECRET = 'SECRET-VALUE-123';

test.use({ viewport: { width: 390, height: 844 } });

test('E7 PRD-F-13, SPEC-SNIP-07: snippet on sample-site/flawed at 390 px makes no request and leaks no value or cookie', async ({
  page,
}) => {
  // Static serve of sample-site/ on a fake origin (cookies need http).
  await page.route('http://sample.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/\/$/, '/index.html');
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) return route.fulfill({ status: 403 });
    try {
      await route.fulfill({
        body: readFileSync(file),
        contentType: TYPES[extname(file)] ?? 'application/octet-stream',
      });
    } catch {
      await route.fulfill({ status: 404 });
    }
  });
  await page.goto('http://sample.test/flawed/?token=Q&x=1#frag');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#updates').fill(SECRET);
  await page.evaluate((s) => {
    document.cookie = `session=${s}; path=/`;
    localStorage.setItem('k', s);
  }, SECRET);

  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  const logs: string[] = [];
  page.on('console', (m) => logs.push(m.text()));

  const returned = await page.evaluate(SNIPPET);
  await page.waitForTimeout(300);

  expect(requests).toEqual([]);
  const out = [String(returned), ...logs].join('\n');
  expect(out).toContain('ConformUI snapshot');
  expect(out).not.toContain(SECRET);
  expect(out).not.toContain('session=');
  expect(out).not.toContain('token=Q');
  const json = JSON.parse(logs.find((l) => l.startsWith('{')) ?? '{}') as {
    schema: string;
    page: { url: string };
    viewport: { width: number };
    elements: unknown[];
  };
  expect(json.schema).toBe('conformui.dom-snapshot');
  expect(json.viewport.width).toBe(390);
  expect(json.elements.length).toBeGreaterThan(5);
  expect(json.page.url).toBe('http://sample.test/flawed/');
  // The page is unchanged: the typed value is still there.
  await expect(page.locator('#updates')).toHaveValue(SECRET);
});
