import { expect, test } from '@playwright/test';

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
