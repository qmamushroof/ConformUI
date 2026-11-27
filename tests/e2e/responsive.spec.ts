import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BIG, sampleRun } from './helpers14-2';
import { createProject, openProjects } from './projects-helpers';

// Responsive at every viewport and zoom level. Browser zoom is emulated by the CSS-pixel viewport: 1280 px at 400% is 320 CSS px
// wide (WCAG 1.4.10 reflow), 1440 px at 50% is 2880 and at 25% is 5760. Intended scroll containers (code, tables) may scroll inside.

const SIZES: [number, number][] = [
  [280, 640],
  [320, 640],
  [360, 740],
  [390, 844],
  [414, 896],
  [568, 320], // short landscape phone
  [600, 900],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1366, 768],
  [1440, 900],
  [1460, 900],
  [1500, 900],
  [1536, 864],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
  [2880, 1800],
  [3840, 2160],
  [5760, 3600],
];

/** Everything wrong with the current layout, as readable strings. */
async function problems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const W = window.innerWidth;
    const H = window.innerHeight;
    const doc = document.documentElement;
    if (doc.scrollWidth > W) out.push(`page scrolls sideways: scrollWidth ${doc.scrollWidth} > ${W}`);
    const name = (el: Element) => {
      const cls = (el as HTMLElement).className;
      const c = typeof cls === 'string' && cls.trim() ? `.${cls.trim().split(/\s+/).join('.')}` : '';
      return `${el.tagName.toLowerCase()}${c} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      for (let e: Element | null = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
      }
      return true;
    };
    const inScroller = (el: Element) => {
      for (let e = el.parentElement; e && e !== doc; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth) return true;
      }
      return false;
    };
    // Visible interactive elements and headings stay inside the viewport horizontally.
    for (const el of Array.from(
      document.querySelectorAll(
        'button, a[href], input, select, textarea, summary, [role=button], [role=option], h1, h2, h3',
      ),
    )) {
      if (!visible(el) || inScroller(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > W + 1 || r.left < -1)
        out.push(`outside viewport (${Math.round(r.left)}..${Math.round(r.right)} of ${W}): ${name(el)}`);
    }
    // Text clipped by overflow on buttons, chips, pills, labels.
    for (const el of Array.from(
      document.querySelectorAll(
        'button, a[href], label, summary, [class*=chip], [class*=pill], [class*=badge], [class*=tag], th, h1, h2, h3',
      ),
    )) {
      if (!visible(el) || el.closest('.sr-only, .visually-hidden')) continue;
      const s = getComputedStyle(el);
      if (s.overflowX === 'visible' || /(auto|scroll)/.test(s.overflowX) || s.textOverflow === 'ellipsis') continue;
      if (el.scrollWidth > el.clientWidth + 1)
        out.push(`text clipped (${el.scrollWidth} > ${el.clientWidth}): ${name(el)}`);
    }
    // Text overflowing its own box sideways without clipping (long unbreakable words).
    for (const el of Array.from(document.querySelectorAll('p, li, dd, dt, td, code, h1, h2, h3, span, div'))) {
      if (el.children.length > 0 || !(el.textContent ?? '').trim() || !visible(el) || inScroller(el)) continue;
      if (el.closest('.sr-only, .visually-hidden')) continue;
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowX) || s.textOverflow === 'ellipsis' || s.whiteSpace === 'pre') continue;
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
        out.push(`text overflows box (${el.scrollWidth} > ${el.clientWidth}): ${name(el)}`);
    }
    // A table header sits above its first body row and spans the table.
    for (const t of Array.from(document.querySelectorAll('table'))) {
      const th = t.querySelector('thead');
      const tb = t.querySelector('tbody');
      if (!th || !tb || !visible(th) || !visible(tb)) continue;
      const a = th.getBoundingClientRect();
      const b = tb.getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      if (a.bottom > b.top + 1 || Math.abs(a.left - b.left) > 1 || a.width < tr.width - 2)
        out.push(
          `table header misplaced (head ${Math.round(a.left)},${Math.round(a.top)} w${Math.round(a.width)}; body ${Math.round(b.left)},${Math.round(b.top)}): ${name(t)}`,
        );
    }
    // Every page uses the same rule: the main column is centred (equal margins) or fills the viewport.
    {
      const m = document.querySelector('main');
      if (m && visible(m)) {
        const r = m.getBoundingClientRect();
        const cw = doc.clientWidth;
        const left = r.left;
        const right = cw - r.right;
        const fills = left < 2 && right < 2;
        if (!fills && Math.abs(left - right) > 4)
          out.push(`main is not centred (left ${Math.round(left)}, right ${Math.round(right)} of ${cw})`);
      }
    }
    // Sheets fit and scroll.
    for (const d of Array.from(document.querySelectorAll('dialog[open], [role=dialog]'))) {
      if (!visible(d)) continue;
      const r = d.getBoundingClientRect();
      const s = getComputedStyle(d);
      if (r.width > W + 1 || r.left < -1 || r.right > W + 1)
        out.push(`dialog wider than viewport (${Math.round(r.left)}..${Math.round(r.right)} of ${W}): ${name(d)}`);
      if (r.height > H + 1 || r.top < -1)
        out.push(`dialog taller than viewport (${Math.round(r.top)}..${Math.round(r.bottom)} of ${H}): ${name(d)}`);
      if (d.scrollHeight > d.clientHeight + 1 && !/(auto|scroll)/.test(s.overflowY)) {
        const inner = Array.from(d.querySelectorAll('*')).some(
          (c) => /(auto|scroll)/.test(getComputedStyle(c).overflowY) && c.clientHeight > 0,
        );
        if (!inner) out.push(`dialog content cut off and not scrollable: ${name(d)}`);
      }
    }
    // Fixed or sticky bars leave room for content on short viewports.
    let covered = 0;
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const s = getComputedStyle(el);
      if ((s.position !== 'fixed' && s.position !== 'sticky') || !visible(el) || el.closest('dialog')) continue;
      const r = el.getBoundingClientRect();
      if (r.width > W * 0.5) covered += r.height;
    }
    if (H <= 400 && covered > H * 0.4)
      out.push(`fixed/sticky bars cover ${Math.round((covered / H) * 100)}% of ${H}px height`);
    // Very large screens do not stretch the content absurdly.
    if (W >= 1920) {
      let lo = Number.POSITIVE_INFINITY;
      let hi = 0;
      let loEl = '';
      let hiEl = '';
      for (const el of Array.from(
        document.querySelectorAll('main h1, main h2, main p, main button, main a[href], main input'),
      )) {
        if (!visible(el) || el.closest('dialog')) continue;
        const r = el.getBoundingClientRect();
        if (r.left < lo) {
          lo = r.left;
          loEl = name(el);
        }
        if (r.right > hi) {
          hi = r.right;
          hiEl = name(el);
        }
      }
      const cw = doc.clientWidth;
      const mr = document.querySelector('main')?.getBoundingClientRect();
      const mainFills = !!mr && mr.left < 2 && cw - mr.right < 2;
      if (mainFills && !document.querySelector('dialog[open]') && Math.abs(lo - (cw - hi)) > 120)
        out.push(`content hugs one side (left ${Math.round(lo)}, right ${Math.round(cw - hi)})`);
      if (hi - lo > 1500) out.push(`content spans ${Math.round(hi - lo)}px on a ${W}px viewport (${loEl} .. ${hiEl})`);
    }
    return out;
  });
}

/** Runs the checks at every size; the screen under test stays as the test left it. */
async function sweep(page: Page, label: string, sizes = SIZES): Promise<void> {
  const failures: string[] = [];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(60);
    for (const p of await problems(page)) failures.push(`${label} @${w}x${h}: ${p}`);
  }
  expect.soft(failures).toEqual([]);
}

const projectPath = (page: Page) => new URL(page.url()).pathname;

// Real (non-overlay) scrollbars take 15 px of width, as on a desktop browser.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test.describe('responsive', () => {
  test.setTimeout(240_000);

  test('onboarding, projects (empty and populated), settings, snippet, 404', async ({ page, fake }) => {
    await fake({ status: 'available+image' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Start a project' })).toBeVisible(BIG);
    await sweep(page, 'onboarding');
    await openProjects(page);
    await sweep(page, 'projects-empty');
    await page.getByRole('button', { name: 'New project' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await sweep(page, 'new-project-sheet');
    await page
      .getByLabel('Project name')
      .fill('A very long project name that goes on and on without any sensible end in sight at all');
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible(BIG);
    await sweep(page, 'project-empty');
    await page.goto('/');
    await sweep(page, 'projects-populated');
    for (const [path, label] of [
      ['/settings', 'settings'],
      ['/snippet', 'snippet'],
      ['/no/such/page', '404'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible(BIG);
      await sweep(page, label);
    }
  });

  test('contract and consent sheet when no on-device model exists, then settings', async ({ page, fake }) => {
    await fake({ status: 'unavailable-not-desktop-chrome' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the sample' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
    await page.getByRole('link', { name: /Contract v\d/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^Contract/ })).toBeVisible(BIG);
    await sweep(page, 'contract-sample');
    await page.getByRole('button', { name: 'Extract contract' }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Allow cloud for this project?' })).toBeVisible(
      BIG,
    );
    await sweep(page, 'consent-sheet');
    await page.getByRole('button', { name: 'Decline' }).click();
    await expect(page.getByText(/Sample results \(pre-computed\)/)).toBeVisible(BIG);
    await sweep(page, 'contract-extracted');
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible(BIG);
    await sweep(page, 'settings-unavailable');
  });

  test('project, contract, run, finding detail and sheets', async ({ page, fake }) => {
    await fake({ status: 'available+image', inferenceSource: 'cloud' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the sample' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
    await sweep(page, 'project');
    const url = projectPath(page);
    await page.goto(`${url}/contract`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible(BIG);
    await sweep(page, 'contract');
    await page.goto(url);
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
    await sweep(page, 'run');
    await page.getByRole('option').first().click();
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    await sweep(page, 'finding-detail');
    await page.getByRole('button', { name: 'More run actions' }).click();
    await sweep(page, 'run-more-menu');
    await page.getByRole('button', { name: 'Export report' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await sweep(page, 'export-sheet');
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Deep Analysis' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await sweep(page, 'deep-analysis-sheet');
  });

  test('run starting (progress) at phone and desktop widths', async ({ page, fake }) => {
    await fake({ status: 'available+image', durationMs: 4000 });
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the sample' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    await sweep(page, 'run-starting', [
      [320, 640],
      [1280, 800],
    ]);
    await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  });

  test('more overlays: add capture, contract review, card menu, rename, delete, clear data', async ({ page, fake }) => {
    await fake({ status: 'available+image' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the sample' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
    const url = projectPath(page);
    await createProject(page, 'Plain');
    await page.getByRole('button', { name: 'Add a Desktop capture' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await sweep(page, 'add-capture-sheet');
    await page.keyboard.press('Escape');
    await page.goto(url);
    await page.getByRole('link', { name: /Contract v\d/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^Contract/ })).toBeVisible(BIG);
    await page.getByRole('button', { name: 'Extract contract' }).click();
    await expect(page.getByRole('button', { name: 'Accept all' }).first()).toBeVisible(BIG);
    await sweep(page, 'contract-review');
    await page.getByRole('button', { name: 'Accept all' }).first().click();
    await sweep(page, 'contract-accepted');
    await page.goto('/');
    await page.getByRole('button', { name: 'More actions for Sample landing page' }).click();
    await sweep(page, 'project-card-menu');
    await page.getByRole('button', { name: 'Rename' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await sweep(page, 'rename-sheet');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'More actions for Sample landing page' }).click();
    await page.getByRole('button', { name: 'Delete…' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await sweep(page, 'delete-sheet');
    await page.keyboard.press('Escape');
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Clear all data' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await sweep(page, 'clear-data-sheet');
  });

  test('200% text size at 1280 px on the main screens', async ({ page, fake }) => {
    await fake({ status: 'available+image' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await sampleRun(page);
    const url = projectPath(page).replace(/\/run\/.*/, '');
    const big = () =>
      page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
    await big();
    await sweep(page, 'run@200%text', [[1280, 800]]);
    for (const [path, label] of [
      [url, 'project'],
      [`${url}/contract`, 'contract'],
      ['/', 'projects'],
      ['/settings', 'settings'],
      ['/snippet', 'snippet'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible(BIG);
      await big();
      await sweep(page, `${label}@200%text`, [[1280, 800]]);
    }
  });
});
