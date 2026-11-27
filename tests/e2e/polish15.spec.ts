import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BIG, sampleRun } from './helpers14-2';

// ROADMAP 15.2: reflow, reduced motion, announcements, alt text, vocabulary, no chat input, progress and repeat clicks.

const noPageScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** Visits every screen of the sample project and checks the page itself never scrolls sideways. */
async function reflowEverywhere(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Try the sample' })).toBeVisible(BIG);
  expect(await noPageScroll(page), 'welcome').toBe(true);
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
  expect(await noPageScroll(page), 'project').toBe(true);
  const projectUrl = new URL(page.url()).pathname;
  await page.goto(`${projectUrl}/contract`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible(BIG);
  expect(await noPageScroll(page), 'contract').toBe(true);
  await page.goto(projectUrl);
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  expect(await noPageScroll(page), 'run').toBe(true);
  await page.getByRole('option').first().click();
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  expect(await noPageScroll(page), 'finding detail').toBe(true);
  for (const path of ['/', '/settings', '/snippet']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible(BIG);
    expect(await noPageScroll(page), path).toBe(true);
  }
}

test.describe('SPEC-UI-06 reflow', () => {
  test('SPEC-UI-06: 320 px wide, no screen scrolls the page sideways', async ({ page, fake }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 320, height: 640 });
    await fake({ status: 'available+image' });
    await reflowEverywhere(page);
  });

  test('SPEC-UI-06: 200% zoom (640 CSS px wide at 1280 px) shows no sideways page scroll', async ({ page, fake }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 640, height: 400 });
    await fake({ status: 'available+image' });
    await reflowEverywhere(page);
  });
});

test('SPEC-UI-06: prefers-reduced-motion removes every transition and animation', async ({ page, fake }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fake({ status: 'available+image' });
  await sampleRun(page);
  const moving = await page.evaluate(() => {
    const out: string[] = [];
    const secs = (v: string) => v.split(',').map((x) => Number.parseFloat(x) * (x.trim().endsWith('ms') ? 0.001 : 1));
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const s = getComputedStyle(el);
      const longest = Math.max(...secs(s.transitionDuration), ...secs(s.animationDuration));
      if (longest > 0.01) out.push(`${el.tagName.toLowerCase()}.${(el as HTMLElement).className}`);
    }
    return out;
  });
  expect(moving).toEqual([]);
});

test('SPEC-UI-06: Run completion is announced in a polite live region and crops carry alt text', async ({
  page,
  fake,
}) => {
  await fake({ status: 'available+image' });
  await sampleRun(page);
  const live = page.locator('[aria-live="polite"]', { hasText: /^Run complete: \d+ fail/ });
  await expect(live).toHaveCount(1);
  await page.getByRole('option').first().click();
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  // Every image-like element has a text alternative: <img alt>, and the SVG crops have an accessible name.
  const missing = await page.evaluate(() => [
    ...Array.from(document.querySelectorAll('img:not([alt])')).map((e) => e.outerHTML.slice(0, 80)),
    ...Array.from(document.querySelectorAll('svg[role="img"]'))
      .filter((e) => !(e.getAttribute('aria-label') ?? '').trim())
      .map((e) => e.outerHTML.slice(0, 80)),
  ]);
  expect(missing).toEqual([]);
  const crops = await page
    .locator('svg[role="img"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  for (const label of crops) expect(label).toMatch(/^(Design|Implementation)/);
});

test('PRD-D-19, SPEC-UI-05: the Run screen speaks only the fixed vocabulary of PRD section 8', async ({
  page,
  fake,
}) => {
  await fake({ status: 'available+image' });
  await sampleRun(page);
  const words = await page.locator('.rowi .meta > span:first-child').allTextContents();
  expect(words.length).toBeGreaterThan(0);
  for (const w of words) expect(w.trim()).toMatch(/^(Critical|Major|Minor|Pass|Fail|Needs review|Not checked.*)$/);
  const body = await page.locator('main').innerText();
  expect(body).not.toMatch(/\b(Passed|Failed|Warning|Unverified|Skipped)\b/);
  expect(body).not.toContain('—'); // SPEC-UI-07: no em dash
});

test('PRD-P-08: no screen has a chat input, and typing into any field sends nothing to the AI', async ({
  page,
  fake,
  fakeCalls,
  aiRequests,
}) => {
  test.setTimeout(120_000);
  await fake({ status: 'available+image' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
  const projectUrl = new URL(page.url()).pathname;
  for (const u of ['/', '/settings', '/snippet', projectUrl, `${projectUrl}/contract`]) {
    await page.goto(u);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible(BIG);
    const names = await page
      .locator('textarea, input[type="text"], input:not([type]), [role="textbox"], [contenteditable="true"]')
      .evaluateAll((els) =>
        els.map((e) => `${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('placeholder') ?? ''} ${e.id}`),
      );
    for (const n of names) expect(n.toLowerCase()).not.toMatch(/chat|ask|message|prompt|assistant|question/);
    await expect(page.getByRole('button', { name: /^(Send message|Ask|Chat|Ask AI)$/i })).toHaveCount(0);
  }
  await page.goto(projectUrl);
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.goto('/snippet');
  const before = (await fakeCalls()).length; // the page reload resets the fake's call log
  for (const box of await page.getByRole('textbox').all()) await box.fill('hello are you there');
  expect((await fakeCalls()).length).toBe(before);
  expect(aiRequests()).toEqual([]);
});

test('SPEC-PERF-08: starting a Run shows progress within 100 ms and a second click is ignored', async ({
  page,
  fake,
}) => {
  await fake({ status: 'available+image', durationMs: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
  const t = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Run');
    if (!btn) throw new Error('no Run button');
    const t0 = performance.now();
    btn.click();
    btn.click(); // repeat click in the same task
    return new Promise<{ ms: number; shown: boolean }>((resolve) => {
      const poll = () => {
        const shown =
          !!document.querySelector('[role="progressbar"]') ||
          btn.getAttribute('aria-busy') === 'true' ||
          btn.hasAttribute('disabled');
        if (shown || performance.now() - t0 > 2000) resolve({ ms: performance.now() - t0, shown });
        else requestAnimationFrame(poll);
      };
      poll();
    });
  });
  expect(t.shown).toBe(true);
  expect(t.ms).toBeLessThan(100);
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  await expect(page.getByRole('heading', { level: 1, name: 'Run 2' })).toHaveCount(0);
});
