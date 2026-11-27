import { expect, test } from './fixtures';

test('SPEC-TEST-01: the shell renders on the e2e build through the fixture', async ({ page, fake }) => {
  await fake({ status: 'available+image' });
  await page.goto('/');
  await expect(page).toHaveTitle(/ConformUI$/);
  await expect(page.locator('#root main')).not.toBeEmpty();
});

test('SPEC-SEC-02, PRD-M-06: the network spy records zero AI requests on a plain load', async ({
  page,
  fake,
  aiRequests,
}) => {
  await fake({ status: 'available+image' });
  await page.goto('/');
  await expect(page.locator('#root main')).not.toBeEmpty();
  expect(aiRequests()).toEqual([]);
});

test('SPEC-TEST-01: fake calls[] is readable and empty before any AI use', async ({ page, fake, fakeCalls }) => {
  await fake({ status: 'downloadable' });
  await page.goto('/');
  await expect(page.locator('#root main')).not.toBeEmpty();
  expect(await fakeCalls()).toEqual([]);
});

test('SPEC-SEC-02: the spy records a googleapis request when one is made', async ({ page, aiRequests }) => {
  await page.route('**/*.googleapis.com/**', (r) => r.abort());
  await page.goto('/');
  await page.evaluate(() => fetch('https://firebasevertexai.googleapis.com/x').catch(() => undefined));
  expect(aiRequests()).toHaveLength(1);
});
