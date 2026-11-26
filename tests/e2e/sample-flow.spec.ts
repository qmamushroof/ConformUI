import { expect, type Page, test } from '@playwright/test';

// ROADMAP 7.3, SPEC §7 E1, E3, E4: the sample flow end to end on the e2e build (FakeAiEngine, no Firebase). Real
// pixels go through the real codec, measure and run services in Chromium.

type Fake = { status?: string; errors?: Record<string, string> };
const fake = async (page: Page, cfg: Fake) => {
  await page.addInitScript((c) => {
    (window as unknown as { __CUI_FAKE__: unknown }).__CUI_FAKE__ = c;
  }, cfg);
};

const BIG = { timeout: 60_000 };

test('SPEC-DEMO-02, PRD-M-13, S25: two clicks from onboarding reach Findings with the device available and image input on', async ({
  page,
}) => {
  await fake(page, { status: 'available+image' });
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'Try the sample' }).click(); // click 1
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
  await page.getByRole('button', { name: 'Run' }).click(); // click 2
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await expect(page.getByTestId('run-summary')).toBeVisible();
  await expect(page).toHaveURL(/\/p\/[^/]+\/run\/(?!new)[^/]+$/);
  await expect(page).toHaveTitle(/^Run · Sample landing page · ConformUI$/);
});

test('SPEC-RUN-13, SPEC-DEMO-05, PRD-M-13: with the device unavailable there is no modal and pre-computed items are labelled', async ({
  page,
}) => {
  await fake(page, { status: 'unavailable-not-desktop-chrome' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await expect(page.getByText('Sample results (pre-computed)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Allow cloud to judge live' })).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  const calls = await page.evaluate(
    () => (window as unknown as { __CUI_FAKE__: { calls?: unknown[] } }).__CUI_FAKE__.calls?.length ?? 0,
  );
  expect(calls).toBe(0);
});

test('SPEC-RUN-13, SPEC-SET-06, PRD-M-06: Allow cloud to judge live asks first, then the counter shows Cloud usage', async ({
  page,
}) => {
  await fake(page, { status: 'unavailable-not-desktop-chrome' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await page.getByRole('button', { name: 'Allow cloud to judge live' }).click();
  await expect(page.getByRole('heading', { name: 'Allow cloud for this project?' })).toBeVisible();
  await page.getByRole('button', { name: 'Allow for this project' }).click();
  await expect(page.getByRole('banner').getByRole('link', { name: /^Privacy: Cloud: \d+ requests?/ })).toBeVisible(BIG);
});

test('SPEC-DEMO-04, SPEC-RUN-09, PRD-M-02: Load fixed implementation then Re-verify resolves the planted defects', async ({
  page,
}) => {
  await fake(page, { status: 'available+image' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await page.getByRole('button', { name: 'Re-verify' }).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Load fixed implementation' }).click();
  await expect(sheet.getByText(/DOM snapshot added/).first()).toBeVisible(BIG);
  await sheet.getByRole('button', { name: 'Run Re-verify' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 2' })).toBeVisible(BIG);
  await expect(page.getByTestId('run-summary')).toContainText('resolved');
});

test('SPEC-DEEP-01, SPEC-DEMO-05: Deep Analysis lists what is sent; a failed request offers the pre-computed result', async ({
  page,
}) => {
  await fake(page, { status: 'unavailable-not-desktop-chrome', errors: { 'deep-analysis': 'AI_FAILED' } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await page.getByRole('button', { name: 'Deep Analysis' }).click();
  await expect(page.getByRole('heading', { name: 'Send this run for Deep Analysis?' })).toBeVisible();
  await page.getByRole('button', { name: 'Send to cloud' }).click();
  await page.getByRole('button', { name: 'Show pre-computed result' }).click();
  await expect(page.getByText('Sample results (pre-computed)')).toBeVisible();
});
