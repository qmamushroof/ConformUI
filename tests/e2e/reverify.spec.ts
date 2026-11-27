import { expect, test } from './fixtures';
import { BIG, sampleRun } from './helpers14-2';

// ROADMAP 14.2, SPEC §7.5 E5 (PRD-F-07.2): Re-verify with the fixed sample build.

test('E5 PRD-F-07.2, SPEC-DEMO-04: Re-verify on the fixed build reads "6 resolved, 1 remaining"; history lists 2 Runs', async ({
  page,
  fake,
}) => {
  await fake({ status: 'unavailable-not-desktop-chrome' });
  await sampleRun(page);
  await page.getByRole('button', { name: 'Re-verify' }).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Load fixed implementation' }).click();
  await expect(sheet.getByText(/DOM snapshot added/).first()).toBeVisible(BIG);
  await sheet.getByRole('button', { name: 'Run Re-verify' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 2' })).toBeVisible(BIG);
  const summary = page.getByTestId('run-summary');
  await expect(summary).toContainText(/6\s*resolved/);
  await expect(summary).toContainText(/1\s*remaining/);
  await expect(page.getByRole('heading', { name: 'Runs', level: 2 })).toBeVisible();
});

test('Re-verify with the captures Run 1 already checked is blocked with a reason until new captures are added', async ({
  page,
  fake,
}) => {
  await fake({ status: 'unavailable-not-desktop-chrome' });
  await sampleRun(page);
  await page.getByRole('button', { name: 'Re-verify' }).first().click();
  const sheet = page.getByRole('dialog');
  const go = sheet.getByRole('button', { name: 'Run Re-verify' });
  await expect(go).toHaveAttribute('aria-disabled', 'true');
  await expect(sheet.getByText('Add new captures first. These are the captures Run 1 already checked.')).toBeVisible();
  await go.click({ force: true });
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Load fixed implementation' }).click();
  await expect(go).not.toHaveAttribute('aria-disabled', 'true', BIG);
});
