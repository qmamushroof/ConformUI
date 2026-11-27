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
