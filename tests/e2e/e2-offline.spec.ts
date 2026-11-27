import { expect, test } from './fixtures';

// ROADMAP 14.1, SPEC §7.5 E2: device available+image, offline. Extract contract and Run on the sample complete with 0 bytes sent.

const BIG = { timeout: 60_000 };

test('PRD-M-04, PRD-M-07, SPEC-SEC-02, E2: offline on-device Extract then Run completes with nothing sent', async ({
  page,
  context,
  fake,
  fakeCalls,
  aiRequests,
}) => {
  await fake({ status: 'available+image' });
  await page.goto('/');
  // Visit 1 installs the service worker and precaches the shell; visit 2 is controlled by it (SPEC-PWA-03).
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);

  const offsite: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== new URL(page.url()).origin && !/^(data|blob):/.test(r.url())) offsite.push(r.url());
  });
  await context.setOffline(true);

  // Extract contract on the device.
  await page.getByRole('link', { name: /Contract v\d/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Contract/ })).toBeVisible(BIG);
  await page.getByRole('button', { name: 'Extract contract' }).click();
  await expect(page.getByText(/AI extracted \d+ requirements?, On-device/)).toBeVisible(BIG);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await fakeCalls()).length).toBeGreaterThan(0);

  // Keep the verified contract, then Run on the sample.
  await page.getByRole('button', { name: 'Keep verified contract' }).click();
  await page.getByRole('banner').getByRole('link', { name: 'ConformUI, projects' }).click();
  await page
    .getByRole('link', { name: /Sample landing page/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await expect(page.getByTestId('run-summary')).toBeVisible();

  // PRD-M-04: engine labels are On-device or Measured only, never Cloud.
  await expect(page.getByText(/^(Measured|On-device)$/).first()).toBeVisible();
  await expect(page.getByText(/^Cloud$/)).toHaveCount(0);
  // PRD-M-07 analogue: the privacy counter still says nothing has left the device, and 0 bytes were sent.
  await expect(
    page.getByRole('banner').getByRole('link', { name: /^Privacy: Nothing (from this project )?has left this device/ }),
  ).toBeVisible();
  expect(aiRequests()).toEqual([]);
  expect(offsite).toEqual([]);
});
