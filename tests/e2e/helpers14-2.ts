import { expect, type Page } from '@playwright/test';

export const BIG = { timeout: 60_000 };

/** Sample project, first Run (two clicks from onboarding). */
export async function sampleRun(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
}
