import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BIG, sampleRun } from './helpers14-2';

// ROADMAP 15.1, SPEC §7.5 E12, SPEC-UI-06, PRD-M-11: axe on every screen in both themes, zero serious/critical violations.

type Theme = 'light' | 'dark';

async function audit(page: Page, theme: Theme, screen: string): Promise<void> {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(250); // let theme transitions settle so contrast is read from final colours
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    bad.map((v) => `${screen}/${theme}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test(`E12 SPEC-UI-06, PRD-M-11: axe finds no serious or critical violation on all eight screens (${theme})`, async ({
    page,
    fake,
  }) => {
    test.setTimeout(180_000);
    await fake({ status: 'available+image' });
    await page.addInitScript((t) => localStorage.setItem('cui-theme', t), theme);

    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole('button', { name: 'Try the sample' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme); // the stored choice is applied on load
    await audit(page, theme, 'onboarding');

    await page.getByRole('button', { name: 'Try the sample' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
    const projectUrl = new URL(page.url()).pathname;
    await audit(page, theme, 'project');

    await page.goto(`${projectUrl}/contract`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible(BIG);
    await audit(page, theme, 'contract');

    await page.goto(projectUrl);
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
    await audit(page, theme, 'run');

    await page.getByRole('option').first().click();
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    await audit(page, theme, 'finding-detail');

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible(BIG);
    await audit(page, theme, 'projects');

    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible(BIG);
    await audit(page, theme, 'settings');

    await page.goto('/snippet');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible(BIG);
    await audit(page, theme, 'snippet');
  });
}

test('E12 SPEC-UI-06: axe passes on the Run screen while a sheet is open', async ({ page, fake }) => {
  await fake({ status: 'available+image' });
  await sampleRun(page);
  await page.getByRole('button', { name: 'More run actions' }).click();
  await page.getByRole('button', { name: 'Export report' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await audit(page, 'light', 'export-sheet');
});
