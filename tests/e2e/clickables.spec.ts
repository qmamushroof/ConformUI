import fs from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BIG } from './helpers14-2';
import { createProject } from './projects-helpers';

// Every clickable does what its label says. Each screen state is walked control by control: click it (and, for a sample
// of them, activate it from the keyboard), and require an observable effect (route change, dialog, DOM change, download,
// new tab) with no console error. External links need a valid href, target and rel. Touch targets are at least 44 px on
// phone widths. Results are tabulated in docs/UI-SWEEP.md.

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const CONTROLS =
  'header a[href], header button, main a[href], main button, main summary, main [role=tab], main [role=option], main [role=switch]';

/** Not exercised: the skip link only exists for keyboard focus. */
const SKIP_NAME = /^Skip to/i;

const path = (page: Page) => new URL(page.url()).pathname;

interface Seen {
  name: string;
  effect: string;
}

async function install(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __mut: number; __mo?: MutationObserver; __opened: string[] };
    w.__mut = 0;
    w.__opened = [];
    w.__mo?.disconnect();
    w.__mo = new MutationObserver((l) => {
      w.__mut += l.length;
    });
    w.__mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    window.open = ((u?: string | URL) => {
      w.__opened.push(String(u));
      return null;
    }) as typeof window.open;
  });
}

/** Activates a control and reports what changed. */
async function press(page: Page, loc: Locator, how: 'click' | 'Enter'): Promise<string> {
  const startUrl = page.url();
  await install(page);
  const download = page.waitForEvent('download', { timeout: 700 }).catch(() => null);
  const chooser = page.waitForEvent('filechooser', { timeout: 700 }).catch(() => null);
  if (how === 'click') await loc.click({ timeout: 5000 });
  else {
    await loc.focus();
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(250);
  const d = await download;
  if (d) return `download ${d.suggestedFilename()}`;
  if (await chooser) return 'file chooser';
  if (page.url() !== startUrl) return 'navigated';
  const s = await page.evaluate(() => {
    const w = window as unknown as { __mut: number; __opened: string[] };
    return { mut: w.__mut, opened: w.__opened.length, dlg: !!document.querySelector('dialog[open]') };
  });
  if (s.opened) return 'opened window';
  if (s.dlg) return 'dialog';
  if (s.mut > 0) return 'dom changed';
  return 'NOTHING';
}

async function closeOverlays(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    if (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape');
    else break;
  }
}

/** Walks every visible control of the current screen. `url` restores the screen between clicks. */
async function walk(page: Page, label: string, url: string, seen: Seen[], consoleErrors: string[]): Promise<void> {
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible(BIG);
  const total = await page.locator(CONTROLS).count();
  expect(total, `${label}: has controls`).toBeGreaterThan(0);
  const dead: string[] = [];
  for (let i = 0; i < total; i++) {
    for (const how of i % 4 === 0 ? (['click', 'Enter'] as const) : (['click'] as const)) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible(BIG);
      await page.waitForTimeout(150);
      const loc = page.locator(CONTROLS).nth(i);
      if (!(await loc.isVisible())) continue;
      const raw = (await loc.getAttribute('aria-label')) ?? (await loc.innerText());
      const name = raw.trim().replace(/\s+/g, ' ').slice(0, 50);
      if (SKIP_NAME.test(name)) continue;
      if (!name) dead.push(`${label}: control #${i} has no accessible name`);
      if (await loc.isDisabled()) {
        const why = (await loc.getAttribute('title')) ?? (await loc.getAttribute('aria-describedby'));
        seen.push({ name, effect: why ? 'disabled, reason given' : 'disabled, NO REASON' });
        if (!why) dead.push(`${label}: "${name}" is disabled without a reason`);
        continue;
      }
      const tag = await loc.evaluate((e) => e.tagName);
      const href = await loc.getAttribute('href');
      if (tag === 'A' && href && /^https?:/.test(href)) {
        expect(await loc.getAttribute('target'), `${label}: ${name} opens in a new tab`).toBe('_blank');
        expect((await loc.getAttribute('rel')) ?? '', `${label}: ${name} rel`).toMatch(/noopener/);
        expect(() => new URL(href)).not.toThrow();
        seen.push({ name, effect: 'external link, valid href, new tab' });
        continue;
      }
      // A link to the screen the person is already on has nothing further to do.
      if (tag === 'A' && href && new URL(href, page.url()).pathname === path(page)) {
        seen.push({ name: `${name} [${how}]`, effect: 'link to the current screen' });
        continue;
      }
      const role = await loc.getAttribute('role');
      // A listbox owns the keyboard (aria-activedescendant); its options are keyed through the list (e12-keyboard.spec).
      if (role === 'option' && how === 'Enter') continue;
      let effect: string;
      try {
        effect = await press(page, loc, how);
      } catch (e) {
        effect = `ERROR ${(e as Error).message.split('\n')[0]}`;
      }
      // Activating something that is already on (a pressed filter, the selected row) changes nothing.
      if (effect === 'NOTHING' && ['true'].includes((await loc.getAttribute('aria-pressed')) ?? ''))
        effect = 'already on (aria-pressed)';
      seen.push({ name: `${name} [${how}]`, effect });
      if (effect === 'NOTHING' || effect.startsWith('ERROR')) dead.push(`${label}: "${name}" via ${how}: ${effect}`);
      await closeOverlays(page);
    }
  }
  expect.soft(dead, 'dead or broken controls').toEqual([]);
  expect.soft(consoleErrors, `${label}: console errors`).toEqual([]);
}

function track(page: Page): string[] {
  const errs: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text());
  });
  page.on('pageerror', (e) => errs.push(e.message));
  return errs;
}

/** Interactive controls smaller than 44 px (WCAG 2.5.5 / PRD touch rule) on the current screen. */
const smallTargets = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(
      document.querySelectorAll('button, a[href], select, textarea, summary, [role=option]'),
    )) {
      if (el.closest('.sr-only, .skip') || (el as HTMLElement).classList.contains('skip')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'inline' || cs.visibility === 'hidden') continue; // inline text links sit in prose
      if (r.height < 43.5 || r.width < 43.5)
        out.push(
          `${Math.round(r.width)}x${Math.round(r.height)} ${el.className} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`,
        );
    }
    return out;
  });

/** Writes what each walk saw to test-results/clickables.json (summarised in docs/UI-SWEEP.md). */
function record(title: string, seen: Seen[]): void {
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync(
    `test-results/clickables-${title.replace(/\W+/g, '-').slice(0, 40)}.json`,
    JSON.stringify(seen, null, 1),
  );
}

test.describe('clickables', () => {
  test.setTimeout(Number(process.env.CLICK_TIMEOUT) || 900_000);

  test('welcome, empty projects, settings, snippet, 404', async ({ page, fake }) => {
    await fake({ status: 'available+image' });
    const errs = track(page);
    const seen: Seen[] = [];
    await walk(page, 'welcome', '/welcome', seen, errs);
    await walk(page, 'projects-empty', '/', seen, errs);
    await walk(page, 'settings', '/settings', seen, errs);
    await walk(page, 'snippet', '/snippet', seen, errs);
    await walk(page, '404', '/no/such/page', seen, errs);
    record(test.info().title, seen);
  });

  test('sample project, contract, projects list, run, finding detail', async ({ page, fake }) => {
    await fake({ status: 'available+image', inferenceSource: 'cloud' });
    const errs = track(page);
    const seen: Seen[] = [];
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the sample' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
    const project = path(page);
    await walk(page, 'sample-project', project, seen, errs);
    await walk(page, 'sample-contract', `${project}/contract`, seen, errs);
    await walk(page, 'projects-populated', '/', seen, errs);
    await page.goto(project);
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
    const run = page.url();
    await walk(page, 'run', run, seen, errs);
    record(test.info().title, seen);
  });

  test('own project: empty project and contract', async ({ page, fake }) => {
    await fake({ status: 'available+image' });
    const errs = track(page);
    const seen: Seen[] = [];
    await createProject(page, 'Own project');
    const project = path(page);
    await walk(page, 'own-project-empty', project, seen, errs);
    await walk(page, 'own-contract-empty', `${project}/contract`, seen, errs);
    record(test.info().title, seen);
  });

  test('touch targets are at least 44 px on phones, on every screen', async ({ page, fake }) => {
    await fake({ status: 'available+image' });
    const failures: string[] = [];
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the sample' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
    const project = path(page);
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
    const run = page.url();
    for (const [w, h] of [
      [320, 640],
      [390, 844],
    ]) {
      await page.setViewportSize({ width: w as number, height: h as number });
      for (const [label, p] of [
        ['project', project],
        ['contract', `${project}/contract`],
        ['run', run],
        ['projects', '/'],
        ['settings', '/settings'],
        ['snippet', '/snippet'],
        ['welcome', '/welcome'],
      ]) {
        await page.goto(p as string);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible(BIG);
        for (const s of await smallTargets(page)) failures.push(`${label}@${w}: ${s}`);
      }
    }
    expect([...new Set(failures)]).toEqual([]);
  });

  for (const alias of ['/project', '/projects', '/p', '/home', '/contract', '/run']) {
    test(`hand-typed ${alias} lands on Projects`, async ({ page, fake }) => {
      await fake({ status: 'available+image' });
      await page.goto('/');
      await page.getByRole('button', { name: 'Try the sample' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
      await page.goto(alias);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible(BIG);
    });
  }

  test('/project/:id lands on the project and /p/:id/run on the project too', async ({ page, fake }) => {
    await fake({ status: 'available+image' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the sample' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
    const project = path(page);
    await page.goto(project.replace('/p/', '/project/'));
    await expect(page).toHaveURL(new RegExp(`${project}$`));
    await page.goto(`${project}/run`);
    await expect(page).toHaveURL(new RegExp(`${project}$`));
  });
});
