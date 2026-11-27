import { expect, test } from './fixtures';
import { BIG, sampleRun } from './helpers14-2';

// ROADMAP 14.2, SPEC §7.5 E4 (PRD-F-06): Deep Analysis end to end on the FakeAiEngine.

type Call = { task: string; mode: string; consent?: { scope: string } };
const deepCalls = (calls: unknown[]) => (calls as Call[]).filter((c) => c.task === 'deep-analysis');

test('E4 PRD-F-06, SPEC-DEEP-01, SPEC-SEC-02: no cloud request before Send; consent sheet; result shows Refined by Cloud', async ({
  page,
  fake,
  fakeCalls,
  aiRequests,
}) => {
  await fake({ status: 'available+image', inferenceSource: 'cloud' });
  // Answer for whichever findings the preview targets: the ids are minted per run, so read them from the request.
  await page.addInitScript(() => {
    const cfg = (window as unknown as { __CUI_FAKE__: { outputs?: Record<string, unknown> } }).__CUI_FAKE__;
    cfg.outputs = {
      ...cfg.outputs,
      'deep-analysis': (req: { user: string }) => {
        const data = JSON.parse(req.user.split('<<<DATA')[1]?.split('DATA>>>')[0] ?? '{}') as {
          targets: { findingId: string }[];
        };
        return {
          items: data.targets.map((t) => ({
            findingId: t.findingId,
            status: 'fail',
            confidence: 'high',
            explanation: 'The cloud confirms the difference.',
            suggestedFix: 'Match the design here.',
          })),
        };
      },
    };
  });
  await sampleRun(page);

  // Opening the sheet is not consent: nothing was sent yet.
  await page.getByRole('button', { name: 'Deep Analysis' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Send this run for Deep Analysis?' })).toBeVisible();
  await expect(sheet.getByText('Total')).toBeVisible();
  expect(deepCalls(await fakeCalls())).toHaveLength(0);
  expect(aiRequests()).toEqual([]);

  // Cancel still sends nothing.
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(deepCalls(await fakeCalls())).toHaveLength(0);

  await page.getByRole('button', { name: 'Deep Analysis' }).click();
  await page.getByRole('button', { name: 'Send to cloud' }).click();
  await expect(page.getByText('Refined by Cloud').first()).toBeVisible(BIG);

  const deep = deepCalls(await fakeCalls());
  expect(deep).toHaveLength(1);
  expect(deep[0]?.mode).toBe('ONLY_IN_CLOUD');
  expect(deep[0]?.consent?.scope).toBe('deep');
  expect(aiRequests()).toEqual([]);
});

test('E4 PRD-F-06.3, SPEC-DEEP-04: offline disables Deep Analysis with a visible reason and sends nothing', async ({
  page,
  fake,
  fakeCalls,
}) => {
  await fake({ status: 'available+image', online: false });
  await sampleRun(page);
  const btn = page.getByRole('button', { name: 'Deep Analysis' });
  await expect(btn).toHaveAttribute('aria-disabled', 'true');
  await btn.click({ force: true });
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(deepCalls(await fakeCalls())).toHaveLength(0);
});

async function answerFor(page: import('@playwright/test').Page, refine: boolean) {
  await page.addInitScript((refine) => {
    const cfg = (window as unknown as { __CUI_FAKE__: { outputs?: Record<string, unknown> } }).__CUI_FAKE__;
    cfg.outputs = {
      ...cfg.outputs,
      'deep-analysis': (req: { user: string }) => {
        const data = JSON.parse(req.user.split('<<<DATA')[1]?.split('DATA>>>')[0] ?? '{}') as {
          targets: { findingId: string }[];
        };
        return {
          items: refine
            ? data.targets.map((t) => ({
                findingId: t.findingId,
                status: 'fail',
                confidence: 'high',
                explanation: 'The cloud confirms the difference.',
                suggestedFix: 'Match the design here.',
              }))
            : [],
        };
      },
    };
  }, refine);
}

test('SPEC-DEEP-07: while Deep Analysis runs a busy status is visible, the button is disabled and cannot start a second request', async ({
  page,
  fake,
  fakeCalls,
}) => {
  await fake({ status: 'available+image', inferenceSource: 'cloud', delayMs: 2500 });
  await answerFor(page, true);
  await sampleRun(page);
  await page.getByRole('button', { name: 'Deep Analysis' }).click();
  await page.getByRole('button', { name: 'Send to cloud' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  const busy = page.getByRole('status').filter({ hasText: 'Deep Analysis is running' });
  await expect(busy).toBeVisible();
  const btn = page.getByRole('button', { name: 'Deep Analysis' });
  await expect(btn).toHaveAttribute('aria-disabled', 'true');
  await btn.click({ force: true });
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByText('Refined by Cloud').first()).toBeVisible(BIG);
  await expect(busy).toHaveCount(0);
  expect(deepCalls(await fakeCalls())).toHaveLength(1);
  await expect(page.getByRole('status').filter({ hasText: /refined \d+ finding/i })).toBeVisible();
});

test('SPEC-DEEP-07: a slow failure shows the busy status, then the mapped notice, and keeps the results', async ({
  page,
  fake,
}) => {
  await fake({ status: 'available+image', errors: { 'deep-analysis': 'APPCHECK_FAILED' }, delayMs: 1500 });
  await sampleRun(page);
  await page.getByRole('button', { name: 'Deep Analysis' }).click();
  await page.getByRole('button', { name: 'Send to cloud' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Deep Analysis is running' })).toBeVisible();
  const alert = page.getByRole('alert').filter({ hasText: /verify this app/i });
  await expect(alert).toBeVisible(BIG);
  await expect(alert).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Show pre-computed result' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Deep Analysis is running' })).toHaveCount(0);
  await expect(page.getByTestId('run-summary')).toBeVisible();
});

test('SPEC-DEEP-06: a success that refines nothing says so', async ({ page, fake }) => {
  await fake({ status: 'available+image', inferenceSource: 'cloud' });
  await answerFor(page, false);
  await sampleRun(page);
  await page.getByRole('button', { name: 'Deep Analysis' }).click();
  await page.getByRole('button', { name: 'Send to cloud' }).click();
  await expect(page.getByRole('status').filter({ hasText: /nothing to refine/i })).toBeVisible(BIG);
  await expect(page.getByText('Refined by Cloud')).toHaveCount(0);
});
