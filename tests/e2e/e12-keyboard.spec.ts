import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BIG, sampleRun } from './helpers14-2';

// ROADMAP 15.1, SPEC-UI-06: keyboard-only E1 (two activations to Findings) and E4 (Deep Analysis sheet).

const focusIs = (page: Page, name: string) =>
  page.evaluate((n) => document.activeElement?.textContent?.trim() === n, name);

/** Tab until the element with this accessible name is focused. */
async function tabTo(page: Page, name: string, max = 80): Promise<void> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() ?? '',
    );
    if (label === name) return;
  }
  throw new Error(`Never focused "${name}"`);
}

test('E1 SPEC-UI-06, PRD-M-13: keyboard only, onboarding to Findings with Tab and Enter, the list answers the arrow keys', async ({
  page,
  fake,
}) => {
  await fake({ status: 'available+image' });
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await tabTo(page, 'Try the sample');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
  await tabTo(page, 'Run');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await expect(page.getByTestId('run-summary')).toBeVisible();

  const list = page.getByRole('listbox', { name: /Findings/ });
  await list.focus();
  await page.keyboard.press('ArrowDown');
  const active = await list.getAttribute('aria-activedescendant');
  expect(active).toBeTruthy();
  await expect(page.locator(`#${active}`)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
});

test('E4 SPEC-UI-06, PRD-F-06: Deep Analysis sheet traps focus, Esc closes it and focus returns to the trigger', async ({
  page,
  fake,
  fakeCalls,
}) => {
  await fake({ status: 'available+image', inferenceSource: 'cloud' });
  await sampleRun(page);

  const trigger = page.getByRole('button', { name: 'Deep Analysis' });
  await expect(page.getByTestId('run-summary')).toBeVisible();
  await expect(trigger).not.toHaveAttribute('aria-disabled', 'true');
  const sheet = page.getByRole('dialog');
  // The Run screen re-renders while it settles, which can drop focus: retry the keyboard activation as a user would.
  await expect(async () => {
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(sheet.getByRole('heading', { name: 'Send this run for Deep Analysis?' })).toBeVisible({
      timeout: 1500,
    });
  }).toPass({ timeout: 15_000 });
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);

  // Trap: many Tab and Shift+Tab presses never leave the dialog.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  // Esc is a cancel: nothing was sent (PRD-F-06).
  expect((await fakeCalls()).filter((c) => (c as { task: string }).task === 'deep-analysis')).toHaveLength(0);
  expect(await focusIs(page, 'Deep Analysis')).toBe(true);
});

test('SPEC-UI-06: the Export sheet traps focus, Esc closes it and focus returns to the menu trigger', async ({
  page,
  fake,
}) => {
  await fake({ status: 'available+image' });
  await sampleRun(page);
  const more = page.getByRole('button', { name: 'More run actions' });
  await more.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Export report' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(more).toBeFocused();
});
