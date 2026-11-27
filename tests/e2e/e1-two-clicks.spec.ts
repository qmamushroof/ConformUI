import { expect, test } from './fixtures';

// ROADMAP 14.1, SPEC §7.5 E1: first visit, onboarding, Try the sample, Run. Findings after two clicks in both device scenarios.

const BIG = { timeout: 60_000 };

test('PRD-M-13, SPEC-DEMO-02, E1: two clicks from onboarding reach Findings with the device available, every item labelled (PRD-M-04)', async ({
  page,
  fake,
  aiRequests,
}) => {
  await fake({ status: 'available+image' });
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'Try the sample' }).click(); // click 1
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
  await page.getByRole('button', { name: 'Run' }).click(); // click 2
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await expect(page.getByTestId('run-summary')).toBeVisible();
  // PRD-M-04: engine labels on the findings.
  await expect(page.getByText(/^(Measured|On-device)$/).first()).toBeVisible();
  expect(aiRequests()).toEqual([]);
});

test('PRD-M-13, SPEC-RUN-13, E1: with the device unavailable there is no modal and pre-computed Judged items are labelled', async ({
  page,
  fake,
  fakeCalls,
  aiRequests,
}) => {
  await fake({ status: 'unavailable-not-desktop-chrome' });
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'Try the sample' }).click(); // click 1
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
  await page.getByRole('button', { name: 'Run' }).click(); // click 2
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await expect(page.getByTestId('run-summary')).toBeVisible();
  await expect(page.getByText('Sample results (pre-computed)')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await fakeCalls()).toEqual([]);
  expect(aiRequests()).toEqual([]);
});
