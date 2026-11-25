import { expect, test } from '@playwright/test';

test('shell renders', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('ConformUI');
  await expect(page.locator('#root main')).not.toBeEmpty();
});
