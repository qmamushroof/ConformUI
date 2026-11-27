import { expect, test } from './fixtures';

// ROADMAP 14.1, SPEC §7.5 E11: manifest valid, installability signals, offline second load opens the shell and the sample
// in at most 1 s (SPEC-PERF-06, PRD-M-12).

const BIG = { timeout: 60_000 };

test('PRD-M-12, SPEC-PWA-02, E11: the manifest is linked, valid and its icons load', async ({
  page,
  request,
  fake,
  aiRequests,
}) => {
  await fake({ status: 'available+image' });
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(new URL(href as string, page.url()).toString());
  expect(res.ok()).toBe(true);
  const m = (await res.json()) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
    theme_color: string;
    background_color: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };
  expect(m.name).toBeTruthy();
  expect(m.short_name).toBeTruthy();
  expect(m.start_url).toBe('/');
  expect(m.scope).toBe('/');
  expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(m.display);
  expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  const sizes = m.icons.map((i) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const icon of m.icons) {
    const r = await request.get(new URL(icon.src, page.url()).toString());
    expect(r.ok(), icon.src).toBe(true);
    expect(r.headers()['content-type']).toContain(icon.type);
  }
  expect(aiRequests()).toEqual([]);
});

test('PRD-M-12, SPEC-PWA-02, E11: a service worker registers and controls the page on the second visit', async ({
  page,
  fake,
}) => {
  await fake({ status: 'available+image' });
  await page.goto('/');
  const scope = await page.evaluate(() => navigator.serviceWorker.ready.then((r) => r.scope));
  expect(scope).toBe(`${new URL(page.url()).origin}/`);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
});

test('SPEC-PERF-06, PRD-M-12, E11: offline second load opens the shell in 1 s or less, and the sample still opens', async ({
  page,
  context,
  fake,
  aiRequests,
}) => {
  await fake({ status: 'available+image' });
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload(); // second visit, now controlled by the service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(page.getByRole('heading', { level: 1, name: 'Check a page against its design' })).toBeVisible();

  await context.setOffline(true);
  const start = Date.now();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Check a page against its design' })).toBeVisible();
  const elapsed = Date.now() - start;
  expect(elapsed, `offline shell took ${elapsed} ms`).toBeLessThanOrEqual(1000);

  // The sample opens offline too.
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
  expect(aiRequests()).toEqual([]);
});
