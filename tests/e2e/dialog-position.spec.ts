import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BIG, sampleRun } from './helpers14-2';

// Every modal sheet is centred on desktop and a full-width bottom sheet at 390 px (design/prototype/assets/app.css).
// A global CSS reset once zeroed the UA `dialog:modal { margin: auto }` and pinned sheets to the top-left.

async function openClearAll(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Clear all data' }).click();
  const sheet = page.getByRole('dialog', { name: 'Clear all data?' });
  await expect(sheet).toBeVisible();
  return sheet;
}

for (const width of [1280, 1764, 2560]) {
  test(`dialog is centred horizontally and vertically at ${width} px`, async ({ page, fake }) => {
    await fake({ status: 'available+image' });
    const sheet = await openClearAll(page, width);
    const vp = page.viewportSize() as { width: number; height: number };
    const box = (await sheet.boundingBox()) as { x: number; y: number; width: number; height: number };
    expect(box.width).toBeLessThanOrEqual(560);
    expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(box.y + box.height / 2 - vp.height / 2)).toBeLessThanOrEqual(2);
  });
}

test('dialog is a full-width bottom sheet at 390 px', async ({ page, fake }) => {
  await fake({ status: 'available+image' });
  const sheet = await openClearAll(page, 390, 844);
  const box = (await sheet.boundingBox()) as { x: number; y: number; width: number; height: number };
  expect(box.x).toBeLessThanOrEqual(1);
  expect(Math.abs(box.width - 390)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y + box.height - 844)).toBeLessThanOrEqual(2);
});

test('wide sheet (Re-verify) is centred at 1440 px and wider than a normal sheet', async ({ page, fake }) => {
  await fake({ status: 'unavailable-not-desktop-chrome' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await sampleRun(page);
  await page.getByRole('button', { name: 'Re-verify' }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible(BIG);
  const box = (await sheet.boundingBox()) as { x: number; y: number; width: number; height: number };
  expect(box.width).toBeGreaterThan(560);
  expect(box.width).toBeLessThanOrEqual(760);
  expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThanOrEqual(2);
  expect(Math.abs(box.y + box.height / 2 - 450)).toBeLessThanOrEqual(2);
});
