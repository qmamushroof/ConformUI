import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { sampleRun } from './helpers14-2';

// ROADMAP 14.2, SPEC §7.5 E6 (PRD-F-09): copy and download of the fix prompt and the report.

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const clipboard = (page: import('@playwright/test').Page) => page.evaluate(() => navigator.clipboard.readText());

test('E6 PRD-F-09: Copy fix prompt puts the prompt on the clipboard', async ({ page, fake }) => {
  await fake({ status: 'available+image' });
  await sampleRun(page);
  await page.getByRole('button', { name: 'Copy fix prompt' }).click();
  await expect.poll(() => clipboard(page)).toMatch(/R-\d+/);
});

test('E6 PRD-F-09: report Copy (Markdown) and Download (Markdown, JSON) carry the run', async ({ page, fake }) => {
  await fake({ status: 'available+image' });
  await sampleRun(page);

  const openExport = async () => {
    await page.getByRole('button', { name: 'More run actions' }).click();
    await page.getByRole('button', { name: 'Export report' }).click();
    return page.getByRole('dialog');
  };

  let sheet = await openExport();
  await sheet.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect.poll(() => clipboard(page)).toMatch(/^#/);

  sheet = await openExport();
  const [md] = await Promise.all([
    page.waitForEvent('download'),
    sheet.getByRole('button', { name: 'Download' }).click(),
  ]);
  expect(md.suggestedFilename()).toMatch(/\.md$/);
  const mdText = readFileSync((await md.path()) as string, 'utf8');
  expect(mdText).toMatch(/^# /);
  expect(mdText).toMatch(/R-\d+/);

  sheet = await openExport();
  await sheet.getByLabel('JSON').check();
  const [js] = await Promise.all([
    page.waitForEvent('download'),
    sheet.getByRole('button', { name: 'Download' }).click(),
  ]);
  expect(js.suggestedFilename()).toMatch(/\.json$/);
  const json = JSON.parse(readFileSync((await js.path()) as string, 'utf8')) as Record<string, unknown>;
  expect(json.schema).toBe('conformui.report');
  expect(json.version).toBe(1);
  expect(JSON.stringify(json)).not.toContain('data:image');
});
