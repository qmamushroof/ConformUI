import { expect, test } from '@playwright/test';

// SPEC-APP-01, SPEC-APP-02, SPEC-APP-04, SPEC-TEST-01: the e2e build boots with the fake engine and no Firebase.

test('SPEC-APP-02, SPEC-APP-04: a first visit lands on Welcome with the header and a titled page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Check a page against its design' })).toBeVisible();
  await expect(page).toHaveTitle('Welcome · ConformUI');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'ConformUI, projects' })).toBeVisible();
  await expect(header.getByRole('link', { name: /^Privacy: Nothing has left this device/ })).toBeVisible();
});

test('SPEC-APP-01, SPEC-TEST-01: the fake engine resolves after first paint and the pill shows On-device ready', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: /Engine: On-device ready/ })).toBeVisible();
  await expect(page).toHaveTitle('Settings · ConformUI');
});

test('SPEC-APP-02: an unknown path shows the not-found notice and a way back', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { level: 1, name: "This page doesn't exist." })).toBeVisible();
  await expect(page).toHaveTitle('Not found · ConformUI');
});

test('SPEC-APP-02: the nav moves between routes without a reload', async ({ page }) => {
  await page.goto('/settings');
  await page.evaluate(() => {
    (window as unknown as { __marker: number }).__marker = 1;
  });
  await page.getByRole('banner').getByRole('link', { name: 'Snippet' }).click();
  await expect(page).toHaveURL(/\/snippet$/);
  await expect(page.getByRole('heading', { level: 1, name: 'DOM snippet' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
});

test('SPEC-APP-01: a 404-style deep link under a project still boots the shell', async ({ page }) => {
  await page.goto('/p/missing/run/none');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toHaveCount(1);
});
