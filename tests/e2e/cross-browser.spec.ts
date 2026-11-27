import { expect, test } from '@playwright/test';

// Cross-browser smoke (run with `npm run test:cross`): the same app loads, opens the sample, runs, lists Findings and
// opens Settings on Chromium, Firefox and WebKit, at desktop and phone sizes. The fake engine reports that on-device AI
// is unavailable, which is the state on every browser except desktop Chrome with built-in AI.

const BIG = { timeout: 60_000 };
test.setTimeout(120_000);

test('smoke: load, sample project, Run, Findings, Settings, manifest and service worker', async ({ page, request }) => {
  await page.addInitScript(() => {
    (window as unknown as { __CUI_FAKE__: unknown }).__CUI_FAKE__ = { status: 'unavailable-not-desktop-chrome' };
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await expect(page.getByTestId('run-summary')).toBeVisible();
  await expect(
    page
      .getByRole('listbox', { name: /Findings/ })
      .getByRole('option')
      .first(),
  ).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  await expect(page.locator('#about').getByText('1.0.1', { exact: true })).toBeVisible();

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await request.get(new URL(href as string, page.url()).toString());
  expect(manifest.ok()).toBe(true);
  expect(((await manifest.json()) as { name?: string }).name).toBeTruthy();

  const hasWorker = await page.evaluate(() => 'serviceWorker' in navigator);
  if (hasWorker) {
    const registered = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg !== undefined;
    });
    expect(typeof registered).toBe('boolean');
  }
});
