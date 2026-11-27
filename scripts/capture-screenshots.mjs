// Regenerates docs/screenshots/*.png from the sample project flow (npm run screenshots).
// Uses the e2e build (FakeAiEngine, no Firebase, no network), so runs are repeatable and show no secrets.
// Env: SCREENSHOT_PORT (default 4923). Needs `npx playwright install chromium` once.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const PORT = Number(process.env.SCREENSHOT_PORT) || 4923;
const BASE = `http://localhost:${PORT}`;
const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const BIG = { timeout: 60_000 };
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };
const MAX_BYTES = 300 * 1024;

const reachable = async () => {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
};

let server;
if (!(await reachable())) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const build = spawnSync(npx, ['vite', 'build', '--mode', 'e2e', '--outDir', 'dist-e2e'], {
    stdio: 'inherit',
    shell: true,
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
  server = spawn(
    npx,
    ['vite', 'preview', '--mode', 'e2e', '--outDir', 'dist-e2e', '--port', String(PORT), '--strictPort'],
    { stdio: 'ignore', shell: true },
  );
  for (let i = 0; i < 60 && !(await reachable()); i++) await new Promise((r) => setTimeout(r, 500));
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const written = [];

/** A fresh browser profile with the fake engine configured before any page script runs. */
async function open(cfg, viewport = DESKTOP) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'light' });
  const page = await context.newPage();
  await page.addInitScript((c) => {
    window.__CUI_FAKE__ = c;
  }, cfg);
  return { context, page };
}

async function shot(page, name) {
  await page.waitForTimeout(400); // let transitions settle
  const file = `${OUT}${name}.png`;
  await page.screenshot({ path: file });
  const size = statSync(file).size;
  written.push([name, size]);
  if (size > MAX_BYTES) console.warn(`WARN ${name}.png is ${Math.round(size / 1024)} KB (limit 300 KB)`);
}

const startSample = async (page) => {
  await page.goto(`${BASE}/`);
  await page.getByRole('button', { name: 'Try the sample' }).click();
  await page.getByRole('heading', { level: 1, name: 'Sample landing page' }).waitFor(BIG);
};
const runSample = async (page) => {
  await page.getByRole('button', { name: 'Run' }).click();
  await page.getByRole('heading', { level: 1, name: 'Run 1' }).waitFor(BIG);
};

try {
  // Desktop, on-device ready, sample flow.
  {
    const { context, page } = await open({ status: 'available+image', inferenceSource: 'cloud' });
    // Deep Analysis answers for whichever findings the run holds (ids are minted per run).
    await page.addInitScript(() => {
      window.__CUI_FAKE__.outputs = {
        'deep-analysis': (req) => {
          const data = JSON.parse(req.user.split('<<<DATA')[1]?.split('DATA>>>')[0] ?? '{}');
          return {
            items: data.targets.map((t) => ({
              findingId: t.findingId,
              status: 'fail',
              confidence: 'high',
              explanation: 'The cloud confirms the measured difference and ties it to the same rule in both viewports.',
              suggestedFix: 'Match the design value shown in the Evidence.',
            })),
          };
        },
      };
    });
    await startSample(page);
    await shot(page, '01-sample-project');
    await page.goto(`${BASE}/`);
    await page
      .getByRole('link', { name: /Sample landing page/ })
      .first()
      .waitFor(BIG);
    await shot(page, '02-projects');

    await page
      .getByRole('link', { name: /Sample landing page/ })
      .first()
      .click();
    await page
      .getByRole('link', { name: /^Contract v1/ })
      .first()
      .click();
    await page.getByRole('heading', { level: 1, name: /^Contract v1/ }).waitFor(BIG);
    await shot(page, '03-contract-review');
    await page
      .getByText(/Expected the mobile page to fit/)
      .first()
      .click();
    await shot(page, '04-contract-inferred');

    await page.goBack();
    await runSample(page);
    await page.getByTestId('run-summary').waitFor();
    await shot(page, '05-run-results');
    await page
      .getByRole('listbox', { name: /Findings/ })
      .getByRole('option')
      .first()
      .click();
    await page.getByText('Evidence', { exact: true }).first().scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 380);
    await shot(page, '06-finding-evidence');

    await page.getByRole('button', { name: 'Deep Analysis' }).click();
    await shot(page, '07-deep-analysis-consent');
    await page.getByRole('button', { name: 'Send to cloud' }).click();
    await page.getByText('Refined by Cloud').first().waitFor(BIG);
    await shot(page, '08-deep-analysis-result');

    await page.getByRole('button', { name: 'More run actions' }).click();
    await page.getByRole('button', { name: 'Export report' }).click();
    await page.getByRole('dialog').waitFor();
    await shot(page, '09-export-report');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Re-verify' }).first().click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Load fixed implementation' }).click();
    await sheet
      .getByText(/DOM snapshot added/)
      .first()
      .waitFor(BIG);
    await shot(page, '10-reverify-sheet');
    await sheet.getByRole('button', { name: 'Run Re-verify' }).click();
    await page.getByRole('heading', { level: 1, name: 'Run 2' }).waitFor(BIG);
    await page.getByTestId('run-summary').waitFor();
    await shot(page, '11-reverify-results');

    // The Contract is locked by the first Run.
    await page.goto(`${page.url().split('/run/')[0]}/contract`);
    await page.getByRole('heading', { level: 1, name: /^Contract v1/ }).waitFor(BIG);
    await shot(page, '12-contract-locked');

    await page.goto(`${BASE}/settings`);
    await page.getByRole('heading', { name: 'Mode' }).waitFor();
    await shot(page, '13-settings-mode');
    await page.locator('#about').scrollIntoViewIfNeeded();
    await shot(page, '14-settings-about');
    await context.close();
  }

  // Model unavailable (not desktop Chrome): the status chip and the Engine panel.
  {
    const { context, page } = await open({ status: 'unavailable-not-desktop-chrome' });
    await startSample(page);
    await shot(page, '15-model-unavailable');
    await page.goto(`${BASE}/settings#engine`);
    await page.locator('#engine').waitFor();
    await shot(page, '16-settings-engine-unavailable');
    await context.close();
  }

  // Offline: the header shows Offline and a Run still completes (Measured checks need no network).
  {
    const { context, page } = await open({ status: 'available+image', online: false });
    await startSample(page);
    await page.getByRole('button', { name: 'Run' }).click();
    await page.getByRole('heading', { level: 1, name: 'Run 1' }).waitFor(BIG);
    await shot(page, '17-offline');
    await context.close();
  }

  // Mobile, 390 x 844.
  {
    const { context, page } = await open({ status: 'available+image' }, MOBILE);
    await startSample(page);
    await shot(page, 'mobile-01-project');
    await runSample(page);
    await page.getByTestId('run-summary').waitFor();
    await shot(page, 'mobile-02-run-results');
    await context.close();
  }
} finally {
  await browser.close();
  if (server) {
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
    else server.kill();
  }
}
for (const [n, s] of written) console.log(`${n}.png ${Math.round(s / 1024)} KB`);
