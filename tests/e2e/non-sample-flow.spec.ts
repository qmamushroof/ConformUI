import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from './fixtures';
import { createProject, SAMPLE } from './projects-helpers';

// Audit: the whole flow on a project that is NOT the sample (new project, design, extract, accept, captures with a
// pasted snapshot, run, finding, fix prompt, re-verify, export). Only the AI is the fake; storage, codec and the
// measure engine are real.

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
const BIG = { timeout: 60_000 };
const DESIGN = resolve(SAMPLE, 'design-desktop.png');
const FLAWED = resolve(SAMPLE, 'flawed-desktop.png');
const FIXED = resolve(SAMPLE, 'fixed-desktop.png');
const dom = (name: string) => readFileSync(resolve(SAMPLE, name), 'utf8');

const EXTRACT = {
  requirements: [
    {
      category: 'presence',
      statement: 'The Start free action is present',
      condition: 'A link with the text Start free is visible',
      checkKind: 'presence',
      box_2d: [380, 80, 460, 240],
      matchHint: { tag: 'a', text: 'Start free' },
      primary: true,
    },
    {
      category: 'content',
      statement: 'A discount banner is shown',
      condition: 'A banner reading Half price today is visible',
      checkKind: 'presence',
      box_2d: [100, 100, 160, 600],
      matchHint: { tag: 'div', text: 'Half price today' },
    },
  ],
};

async function addCapture(page: import('@playwright/test').Page, file: string, snapshot: string) {
  await page.getByRole('button', { name: /^Add a Desktop capture/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Add capture' });
  await sheet.locator('input[type=file]').setInputFiles(file);
  await sheet.getByRole('button', { name: 'Add capture' }).click();
  await expect(page.getByText('Desktop capture', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Paste snapshot' }).first().click();
  const paste = page.getByRole('dialog', { name: /Paste DOM snapshot/ });
  await paste.getByLabel('Snapshot JSON').fill(snapshot);
  await paste.getByRole('button', { name: 'Add snapshot' }).click();
  await expect(page.getByText(/Snapshot added, \d+ elements/).first()).toBeVisible();
}

test('a new (non-sample) project works end to end: extract, accept all, captures, run, finding, fix prompt, re-verify, export', async ({
  page,
  fake,
  aiRequests,
}) => {
  await fake({ status: 'available+image', outputs: { 'extract-contract': EXTRACT } });
  await createProject(page, 'My own page');
  await page.locator('#captures input[type=file]').first().setInputFiles(DESIGN);
  await expect(page.getByText('Desktop design', { exact: true })).toBeVisible();

  // Extract (fake) -> the contract is active for a non-sample project.
  await page.getByRole('link', { name: 'Extract contract' }).click();
  await page.getByRole('button', { name: 'Extract contract' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Contract v1/ })).toBeVisible(BIG);
  await expect(page.getByText('The Start free action is present').first()).toBeAttached();

  // Accept all: items become accepted, the button goes away and a toast says how many.
  const acceptAll = page.getByRole('button', { name: 'Accept all' });
  await expect(acceptAll).toBeVisible();
  await acceptAll.click();
  await expect(page.getByText(/^Accepted \d+ requirements?$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept all' })).toHaveCount(0);

  // Captures with a pasted snapshot, then Run.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Projects' }).click();
  await page
    .getByRole('link', { name: /My own page/ })
    .first()
    .click();
  await addCapture(page, FLAWED, dom('flawed-desktop.dom.json'));
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await expect(page.getByTestId('run-summary')).toBeVisible();

  // The contract is now locked by Run 1.
  // Open a failing finding and copy the fix prompt.
  const fail = page
    .getByRole('listbox', { name: /Findings/ })
    .getByRole('option')
    .first();
  await expect(fail).toBeVisible();
  await fail.click();
  await expect(page.getByRole('region', { name: /discount banner/ })).toBeVisible();
  await page.getByRole('button', { name: 'Copy fix prompt' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/R-\d+/);

  // Re-verify with another capture, added in the sheet (a non-sample project has no "Load fixed implementation").
  await page.getByRole('button', { name: 'Re-verify' }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('button', { name: 'Load fixed implementation' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Run Re-verify' })).toHaveAttribute('aria-disabled', 'true');
  await sheet.locator('input[type=file]').first().setInputFiles(FIXED);
  await expect(sheet.getByRole('button', { name: 'Run Re-verify' })).not.toHaveAttribute('aria-disabled', 'true');
  await sheet.getByRole('button', { name: 'Run Re-verify' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 2' })).toBeVisible(BIG);
  await expect(page.getByTestId('run-summary')).toBeVisible();

  // Export report.
  await page.getByRole('button', { name: 'More run actions' }).click();
  await page.getByRole('button', { name: 'Export report' }).click();
  const [md] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('dialog').getByRole('button', { name: 'Download' }).click(),
  ]);
  expect(md.suggestedFilename()).toMatch(/\.md$/);
  expect(aiRequests()).toEqual([]);
});

test('sample draft: Accept all in the notice updates the count and confirms with a toast', async ({ page, fake }) => {
  await fake({ status: 'available+image' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await page.getByRole('link', { name: /Contract v\d/ }).click();
  await page.getByRole('button', { name: 'Extract contract' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'AI contract (draft)' })).toBeVisible(BIG);
  await expect(page.getByText(/, 0 accepted$/)).toBeVisible();
  await page.getByRole('button', { name: 'Accept all' }).click();
  await expect(page.getByText(/^Accepted \d+ requirements?$/)).toBeVisible();
  await expect(page.getByText(/, 0 accepted$/)).toHaveCount(0);
  await expect(page.getByText(/^\d+ requirements?, \d+ accepted$/)).toBeVisible();
});

test('sample draft: Use AI contract makes it active and says so', async ({ page, fake }) => {
  await fake({ status: 'available+image' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await page.getByRole('link', { name: /Contract v\d/ }).click();
  await page.getByRole('button', { name: 'Extract contract' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'AI contract (draft)' })).toBeVisible(BIG);
  await page.getByRole('button', { name: 'Use AI contract' }).click();
  await expect(page.getByText(/^AI contract is now active as Contract v\d+$/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: /^Contract v\d+/ })).toBeVisible();
});

test('run screen controls give visible results: Diff overlay, Full page, Preview fix prompt, Copy run ID, contract export', async ({
  page,
  fake,
}) => {
  await fake({ status: 'available+image' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  for (const name of ['Diff overlay', 'Full page']) {
    const t = page.getByRole('button', { name }).first();
    await t.click();
    await expect(t).toHaveAttribute('aria-pressed', 'true');
    await t.click();
    await expect(t).toHaveAttribute('aria-pressed', 'false');
  }
  await page.getByRole('button', { name: 'More run actions' }).click();
  await page.getByRole('button', { name: 'Copy run ID' }).click();
  await expect(page.getByText('Run ID copied')).toBeVisible();
  await page.getByRole('button', { name: 'More run actions' }).click();
  await page.getByRole('button', { name: 'Preview fix prompt' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);

  // Locked contract: Edit as v2 reveals the editing actions; contract export downloads.
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Sample landing page' }).click();
  await page
    .getByRole('link', { name: /Contract v\d/ })
    .first()
    .click();
  await expect(page.getByText(/^Locked by Run 1/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Edit as v2' }).click();
  await expect(page.getByRole('button', { name: 'Add requirement' })).toBeVisible();
  await page
    .getByRole('button', { name: /More contract actions|More actions/ })
    .first()
    .click();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export contract as Markdown' }).click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.md$/);
});
