import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BIG, sampleRun } from './helpers14-2';

// Layout regression: the list/detail split must not grow with the viewport height (no dead space before the next section).
// Zoomed-out browsers are emulated by large CSS viewports (3840x2160 is 50% on a 1920 screen).

const SIZES: [number, number][] = [
  [1280, 800],
  [1920, 1080],
  [3840, 2160],
  [1000, 2400], // tall single-column layout
];
const MAX_GAP = 64;

/** Gap below the tallest content in each split, to the split's bottom edge; and to the next element when one follows. */
async function splitMetrics(page: Page) {
  return page.evaluate(() => {
    const out: { name: string; slack: number; toNext: number | null }[] = [];
    for (const split of Array.from(document.querySelectorAll('.split'))) {
      const bottoms = Array.from(split.querySelectorAll(':scope > *')).map((col) => {
        const kids = Array.from(col.children);
        const last = kids[kids.length - 1] ?? col;
        return last.getBoundingClientRect().bottom;
      });
      const sb = split.getBoundingClientRect().bottom;
      const next = split.nextElementSibling ?? split.parentElement?.nextElementSibling ?? null;
      out.push({
        name: split.className,
        slack: sb - Math.max(...bottoms),
        toNext: next ? next.getBoundingClientRect().top - Math.max(...bottoms) : null,
      });
    }
    return out;
  });
}

async function noSidewaysScroll(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw).toBeLessThanOrEqual(iw);
  const left = await page.evaluate(() => document.querySelector('.hdr .brand')?.getBoundingClientRect().left ?? 0);
  expect(left, 'header brand starts on screen').toBeGreaterThanOrEqual(0);
}

async function engineGap(page: Page) {
  return page.evaluate(() => {
    const split = document.querySelector('.split');
    const trace = document.getElementById('trace-h')?.closest('section');
    if (!split || !trace) return null;
    const bottoms = Array.from(split.querySelectorAll(':scope > *')).map((col) => {
      const kids = Array.from(col.children);
      return (kids[kids.length - 1] ?? col).getBoundingClientRect().bottom;
    });
    return trace.getBoundingClientRect().top - Math.max(...bottoms);
  });
}

test.describe('split layout has no dead space', () => {
  for (const [w, h] of SIZES) {
    test(`${w}x${h} Run 1: gap from the tallest column to Engine trace stays small`, async ({ page, fake }) => {
      await fake({ status: 'unavailable-not-desktop-chrome' });
      {
        await page.setViewportSize({ width: w, height: h });
        await sampleRun(page);
        const gap = await engineGap(page);
        expect(gap, `${w}x${h}: trace and split exist`).not.toBeNull();
        expect(gap as number, `${w}x${h}: gap to Engine trace`).toBeLessThan(MAX_GAP);
        expect(gap as number, `${w}x${h}: trace is not above content`).toBeGreaterThanOrEqual(0);
        for (const m of await splitMetrics(page)) expect(m.slack, `${w}x${h} slack in ${m.name}`).toBeLessThan(MAX_GAP);
        await noSidewaysScroll(page);
      }
    });

    test(`${w}x${h} Contract page: split has no dead space and no sideways scroll`, async ({ page, fake }) => {
      await fake({ status: 'unavailable-not-desktop-chrome' });
      {
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/');
        await page.getByRole('button', { name: 'Try the sample' }).click();
        await expect(page.getByRole('button', { name: 'Run' })).toBeVisible(BIG);
        const ms = await splitMetrics(page);
        for (const m of ms) expect(m.slack, `${w}x${h} slack in ${m.name}`).toBeLessThan(MAX_GAP);
        await noSidewaysScroll(page);
      }
    });

    test(`${w}x${h} Run 2 (re-verify): same guarantees`, async ({ page, fake }) => {
      await fake({ status: 'unavailable-not-desktop-chrome' });
      {
        await page.setViewportSize({ width: w, height: h });
        await sampleRun(page);
        await page.getByRole('button', { name: 'Re-verify' }).first().click();
        const sheet = page.getByRole('dialog');
        await sheet.getByRole('button', { name: 'Load fixed implementation' }).click();
        await expect(sheet.getByText(/DOM snapshot added/).first()).toBeVisible(BIG);
        await sheet.getByRole('button', { name: 'Run Re-verify' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Run 2' })).toBeVisible(BIG);
        const gap = await engineGap(page);
        if (gap !== null) expect(gap, `${w}x${h}: gap to Engine trace`).toBeLessThan(MAX_GAP);
        for (const m of await splitMetrics(page)) expect(m.slack, `${w}x${h} slack in ${m.name}`).toBeLessThan(MAX_GAP);
        await noSidewaysScroll(page);
      }
    });
  }
});
