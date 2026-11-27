import { expect, test } from './fixtures';

// ROADMAP 14.1, SPEC §7.5 E3, SPEC-DEMO-05: device unavailable, Extract. The consent sheet lists images and bytes, nothing
// is sent before Allow (SPEC-SEC-02), Allow asks PREFER_ON_DEVICE and labels Cloud, Decline falls back.

const BIG = { timeout: 60_000 };
const UNAVAILABLE = { status: 'unavailable-not-desktop-chrome' } as const;

type Call = { task?: string; mode?: string };

test.describe('E3 sample project', () => {
  test.beforeEach(async ({ page, fake }) => {
    await fake(UNAVAILABLE);
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the sample' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
    await page.getByRole('link', { name: /Contract v\d/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^Contract/ })).toBeVisible(BIG);
  });

  test('PRD-M-06, SPEC-DEMO-05, SPEC-SEC-02: Extract opens the consent sheet listing the images and bytes, with zero AI calls before Allow', async ({
    page,
    fakeCalls,
    aiRequests,
  }) => {
    await page.getByRole('button', { name: 'Extract contract' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'Allow cloud for this project?' })).toBeVisible(BIG);
    await expect(sheet.locator('.sendlist li').first()).toContainText(/\d/);
    await expect(sheet.locator('.sendlist li.total')).toContainText('Total');
    await expect(sheet.getByRole('button', { name: 'Decline' })).toBeVisible();
    expect(await fakeCalls()).toEqual([]);
    expect(aiRequests()).toEqual([]);
  });

  test('PRD-H-05, SPEC-DEMO-05: Decline sends nothing and shows the pre-computed extraction, labelled', async ({
    page,
    fakeCalls,
    aiRequests,
  }) => {
    await page.getByRole('button', { name: 'Extract contract' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Decline' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(/Sample results \(pre-computed\): \d+ requirements?/)).toBeVisible(BIG);
    expect(await fakeCalls()).toEqual([]);
    expect(aiRequests()).toEqual([]);
    await expect(
      page
        .getByRole('banner')
        .getByRole('link', { name: /^Privacy: Nothing (from this project )?has left this device/ }),
    ).toBeVisible();
  });

  test('PRD-M-06, SPEC-SEC-02: Allow asks with PREFER_ON_DEVICE after consent and the result is labelled Cloud', async ({
    page,
    fakeCalls,
  }) => {
    await page.getByRole('button', { name: 'Extract contract' }).click();
    expect(await fakeCalls()).toEqual([]);
    await page.getByRole('dialog').getByRole('button', { name: 'Allow for this project' }).click();
    await expect(page.getByText(/AI extracted \d+ requirements?, Cloud/)).toBeVisible(BIG);
    const calls = (await fakeCalls()) as Call[];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.mode === 'PREFER_ON_DEVICE')).toBe(true);
    await expect(page.getByText(/^Cloud$/).first()).toBeVisible();
  });
});

test('PRD-H-05, PRD-M-06, SPEC-SEC-02: on a new project, Extract with the device unavailable asks first; Decline leaves a manual contract and sends nothing', async ({
  page,
  fake,
  fakeCalls,
  aiRequests,
}) => {
  await fake(UNAVAILABLE);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a project' }).click();
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByLabel('Project name').fill('Checkout page');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout page' })).toBeVisible(BIG);
  await page.locator('input[type="file"]').first().setInputFiles('tests/fixtures/images/missing-element-with.png');
  await expect(page.getByAltText('Desktop design')).toBeVisible(BIG);
  await page.getByRole('link', { name: 'Extract contract' }).click();
  await page.getByRole('button', { name: 'Extract contract' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Allow cloud for this project?' })).toBeVisible(BIG);
  expect(await fakeCalls()).toEqual([]);
  expect(aiRequests()).toEqual([]);
  await sheet.getByRole('button', { name: 'Decline' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/pre-computed/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add requirement' })).toBeVisible();
  expect(await fakeCalls()).toEqual([]);
  expect(aiRequests()).toEqual([]);
});
