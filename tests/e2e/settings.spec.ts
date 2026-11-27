import { expect, test } from './fixtures';
import { createProject } from './projects-helpers';

// ROADMAP 14.3, SPEC §7.5 E10 (SPEC-TEST-03): Settings. Mode change persists, revoking cloud consent makes the next
// cloud request ask again, Clear all data resets the app, and the on-device model download starts directly from the
// click. PRD-F-11, SPEC-SET-01, SPEC-SET-04, SPEC-SET-05, SPEC-SET-07, SPEC-SEC-02. Real IndexedDB; fake engine.

const BIG = { timeout: 60_000 };

test.afterEach(({ aiRequests }) => {
  expect(aiRequests()).toEqual([]); // SPEC-SEC-02: the fake never reaches a cloud host
});

test('PRD-F-11, SPEC-SET-04: choosing a mode saves it, tells the person when it applies and survives a reload', async ({
  page,
  fake,
}) => {
  await fake({ status: 'available+image' });
  await page.goto('/settings');
  const auto = page.getByRole('radio', { name: /^Auto/ });
  const cloud = page.getByRole('radio', { name: /^Cloud only/ });
  await expect(auto).toBeChecked();
  await cloud.check();
  await expect(page.getByText('Mode: Cloud only. Applies to the next request.')).toBeVisible();
  await expect(cloud).toBeChecked();
  // The header's engine pill follows the new mode without leaving the screen.
  await expect(page.getByRole('banner').getByRole('link', { name: /^Engine: Cloud/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('radio', { name: /^Cloud only/ })).toBeChecked();
  await page.getByRole('radio', { name: /^On-device only/ }).check();
  await expect(page.getByText('Mode: On-device only. Applies to the next request.')).toBeVisible(); // saved
  await page.reload();
  await expect(page.getByRole('radio', { name: /^On-device only/ })).toBeChecked();
});

test('PRD-F-11, SPEC-SET-04: On-device only is unavailable where the browser has no on-device model', async ({
  page,
  fake,
}) => {
  await fake({ status: 'unavailable-not-desktop-chrome' });
  await page.goto('/settings');
  await expect(page.getByRole('radio', { name: /^On-device only/ })).toBeDisabled();
  await expect(page.getByText('Not available: this browser has no on-device model.')).toBeVisible();
});

test('PRD-F-11, SPEC-SET-01, SPEC-AI-01: Download model does nothing until clicked, then runs from the click and shows ready', async ({
  page,
  fake,
  fakeCalls,
}) => {
  await fake({ status: 'downloadable' });
  await page.goto('/settings');
  const download = page.getByRole('button', { name: 'Download model' });
  await expect(download).toBeVisible();
  await expect(page.getByText('On-device model not downloaded')).toBeVisible();
  await expect(page.getByText('Nothing starts until you press the button.')).toBeVisible();
  // No download starts by itself: the status is still "not downloaded" after the page settled.
  await page.waitForTimeout(500);
  await expect(download).toBeVisible();
  expect(await fakeCalls()).toEqual([]);

  await download.click();
  await expect(page.getByText('On-device model ready', { exact: true })).toBeVisible();
  await expect(download).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('link', { name: /Engine: On-device ready/ })).toBeVisible();
  expect(await fakeCalls()).toEqual([]); // downloading is not an AI request
});

test('PRD-F-11, SPEC-SET-05, SPEC-PROJ-07: revoking cloud consent removes the row and the next cloud request asks again', async ({
  page,
  fake,
  fakeCalls,
}) => {
  await fake({ status: 'unavailable-not-desktop-chrome' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  expect(await fakeCalls()).toEqual([]); // nothing was asked of any engine before consent
  const allow = page.getByRole('button', { name: 'Allow cloud to judge live' });
  await allow.click();
  await expect(page.getByRole('heading', { name: 'Allow cloud for this project?' })).toBeVisible();
  await page.getByRole('button', { name: 'Allow for this project' }).click();
  await expect(page.getByRole('banner').getByRole('link', { name: /^Privacy: Cloud: \d+ requests?/ })).toBeVisible(BIG);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Settings' }).click();
  const list = page.getByRole('list', { name: 'Projects allowed to use the cloud' });
  await expect(list.getByText('Sample landing page')).toBeVisible();
  await list.getByRole('button', { name: 'Revoke cloud for Sample landing page' }).click();
  await expect(page.getByText('Revoked cloud for Sample landing page')).toBeVisible();
  await expect(
    page.getByText('No project can use the cloud. Each project asks before its first cloud request.'),
  ).toBeVisible();
  await expect(page.getByText('No project can use the cloud.')).toBeFocused();

  // The revocation is stored: after a reload the project has no consent, and the next cloud step (Extract contract
  // on the sample with the device unavailable, SPEC-DEMO-05) asks again instead of sending.
  await page.reload();
  const before = (await fakeCalls()).length;
  await expect(page.getByText('No project can use the cloud.')).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Projects' }).click();
  await page.getByRole('link', { name: /Sample landing page/ }).click();
  await page
    .getByRole('link', { name: /^Contract/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Extract contract' }).click();
  await expect(page.getByRole('heading', { name: 'Allow cloud for this project?' })).toBeVisible();
  await page.getByRole('button', { name: 'Decline' }).click();
  await expect(page.getByRole('heading', { name: 'Allow cloud for this project?' })).toHaveCount(0);
  expect((await fakeCalls()).length).toBe(before); // declining sent nothing
});

test('PRD-F-11, SPEC-SET-07: Clear all data needs the tick, deletes every project, resets the mode and returns to Welcome', async ({
  page,
  fake,
}) => {
  await fake({ status: 'available+image' });
  await createProject(page, 'Gone soon');
  await page.goto('/settings');
  await page.getByRole('radio', { name: /^Cloud only/ }).check();
  await expect(page.getByText('Mode: Cloud only. Applies to the next request.')).toBeVisible();

  await page.getByRole('button', { name: 'Clear all data' }).click();
  const sheet = page.getByRole('dialog', { name: 'Clear all data?' });
  await expect(sheet).toBeVisible();
  const confirm = sheet.getByRole('button', { name: 'Clear all data' });
  await expect(confirm).toHaveAttribute('aria-disabled', 'true');
  await confirm.click({ force: true }); // aria-disabled: nothing happens, the tick box gets focus
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('checkbox')).toBeFocused();
  await sheet.getByRole('checkbox').check();
  await expect(confirm).not.toHaveAttribute('aria-disabled', 'true');
  await confirm.click();

  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Check a page against its design' })).toBeVisible();
  await page.getByRole('button', { name: 'Start a project' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'No projects yet' })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('radio', { name: /^Auto/ })).toBeChecked();
  await expect(page.getByText('0 projects on this device.')).toBeVisible();
});

test('PRD-F-11, SPEC-SET-07: Cancel in Clear all data deletes nothing', async ({ page, fake }) => {
  await fake({ status: 'available+image' });
  await createProject(page, 'Stays put');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Clear all data' }).click();
  await page.getByRole('dialog', { name: 'Clear all data?' }).getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Projects' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Stays put' })).toBeVisible();
});
