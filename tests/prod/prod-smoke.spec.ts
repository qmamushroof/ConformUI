import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

// The e2e build hides production-only failures (a duplicated React copy broke every route in production while CI was
// green). Load real routes on the production build: no route error screen, no uncaught page error.
const ROUTES = ['/', '/welcome', '/settings', '/snippet'];

for (const route of ROUTES) {
  test(`production build renders ${route} without a route error`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(route);
    await expect(page.locator('#root main')).not.toBeEmpty();
    await expect(page.getByText('Something went wrong on this screen')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('production build: the sample project opens', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Something went wrong on this screen')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// O1 (offline): the installed app must open from the service worker with no network. Chrome showed its own
// "You're offline" page on reload, so every navigation entry point is exercised with the network cut.
const OFFLINE_ENTRIES = ['/', '/?utm_source=pwa&homescreen=1', '/settings', '/p/p1/run/r1', '/welcome'];

async function activated(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
}

async function controlled(page: Page): Promise<void> {
  await activated(page);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

for (const entry of OFFLINE_ENTRIES) {
  test(`offline: the installed app shell loads at ${entry}`, async ({ page, context }) => {
    await controlled(page);
    await context.setOffline(true);
    const response = await page.goto(entry);
    expect(response?.ok()).toBe(true);
    await expect(page.locator('#root main')).not.toBeEmpty();
    await expect(page.getByText('Something went wrong on this screen')).toHaveCount(0);
  });
}

test('offline: reload with the network cut still renders the app', async ({ page, context }) => {
  await controlled(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#root main')).not.toBeEmpty();
});

test('offline: the manifest start_url and scope are served by the precache', async ({ page, context, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  await controlled(page);
  await context.setOffline(true);
  const response = await page.goto(manifest.start_url);
  expect(response?.ok()).toBe(true);
  await expect(page.locator('#root main')).not.toBeEmpty();
});

test('first visit: the worker controls the page it installed from, so offline works without a second load', async ({
  page,
  context,
}) => {
  await activated(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 5_000 }).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#root main')).not.toBeEmpty();
});

// A redeploy: serve a copy of dist/ whose app shell and sw.js can be swapped for a changed build.
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serve(root: string): Promise<Server> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
    let file = join(root, path);
    if (path === '/' || !existsSync(file) || !extname(file)) file = join(root, 'index.html');
    const noCache = path === '/sw.js' || file.endsWith('index.html');
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      ...(noCache ? { 'Cache-Control': 'no-cache' } : {}),
    });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

test('offline: a worker waiting after a redeploy leaves the active one serving the app', async ({ browser }) => {
  const root = mkdtempSync(join(tmpdir(), 'cui-redeploy-'));
  cpSync('dist', root, { recursive: true });
  const server = await serve(root);
  const origin = `http://localhost:${(server.address() as AddressInfo).port}`;
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/`);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    // Redeploy: new shell revision and a changed worker script.
    writeFileSync(
      join(root, 'index.html'),
      `${readFileSync(join(root, 'index.html'), 'utf8')}
<!-- v2 -->`,
    );
    writeFileSync(
      join(root, 'sw.js'),
      `${readFileSync(join(root, 'sw.js'), 'utf8')}
// v2`,
    );
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update();
    });
    await expect
      .poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting))
      .toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#root main')).not.toBeEmpty();
    for (const path of ['/settings', '/p/p1/run/r1', '/?utm_source=pwa']) {
      const response = await page.goto(`${origin}${path}`);
      expect(response?.ok()).toBe(true);
      await expect(page.locator('#root main')).not.toBeEmpty();
    }
  } finally {
    await context.close();
    server.close();
  }
});
