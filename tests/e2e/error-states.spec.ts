import { resolve } from 'node:path';
import { cloudTimeoutCopy, stateCopy, copy as uiCopy } from '../../src/app/copy';
import { ERROR_CODES, type ErrorCode } from '../../src/shared/kernel';
import { expect, test } from './fixtures';
import { createProject, SAMPLE } from './projects-helpers';

// ROADMAP 14.3, SPEC §7.5 E13 (SPEC-TEST-03), SPEC-UI-05: every `ErrorCode` renders its copy from `app/copy.ts`.
//
// Reachability. The fake engine throws a scripted `CuiError(code)` per task (SPEC §7.2 `errors`), after its guards.
// - Deep Analysis rethrows every engine error unchanged and the Run screen shows `stateCopy[code]` (title and detail)
//   through `errorView`, so ALL 21 codes are rendered through the real UI by scripting `deep-analysis`. For the codes
//   that real Deep Analysis cannot raise (image, snapshot and storage codes) the injection is synthetic: it proves the
//   notice maps the code to its copy, nothing more.
// - Extract contract maps engine errors to a Not checked reason first (`failReason`): OFFLINE, CLOUD_DISABLED,
//   DEVICE_* and the rest show the OFFLINE, CLOUD_DISABLED, DEVICE_UNAVAILABLE and AI_FAILED copy. Covered below.
// - IMAGE_UNSUPPORTED, IMAGE_TOO_LARGE and IMAGE_DECODE_FAILED from the real codec: inputs.spec.ts (E8).
// - STORAGE_UNAVAILABLE from a real failure to open IndexedDB: the Projects screen test below.
// - Every code has non-empty copy: the unit test in tests/unit/app/copy.test.ts ("SPEC-UI-05: %s has a title and a
//   tone"), which is also what covers any code a future screen does not show.

const BIG = { timeout: 60_000 };
const DESIGN = resolve(SAMPLE, 'design-desktop.png');

test.afterEach(({ aiRequests }) => {
  expect(aiRequests()).toEqual([]); // SPEC-SEC-02: errors never come from a real cloud host here
});

for (const code of ERROR_CODES) {
  test(`SPEC-UI-05, SPEC-TEST-03: ${code} thrown during Deep Analysis shows its copy`, async ({ page, fake }) => {
    await fake({ status: 'available+image', errors: { 'deep-analysis': code } });
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the sample' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
    await page.getByRole('button', { name: 'Deep Analysis' }).click();
    await page.getByRole('button', { name: 'Send to cloud' }).click();

    const copy = code === 'AI_TIMEOUT' ? cloudTimeoutCopy : stateCopy[code as ErrorCode];
    const notice = page.getByRole('alert').filter({ hasText: copy.title });
    await expect(notice).toBeVisible(BIG);
    if (copy.detail) await expect(notice).toContainText(copy.detail);
    // The run and its findings are kept (SPEC-DEEP-*, "Your results are kept").
    await expect(page.getByTestId('run-summary')).toBeVisible();
  });
}

const EXTRACT_COPY: [ErrorCode, ErrorCode][] = [
  ['OFFLINE', 'OFFLINE'],
  ['CLOUD_DISABLED', 'CLOUD_DISABLED'],
  ['DEVICE_UNAVAILABLE', 'DEVICE_UNAVAILABLE'],
  ['DEVICE_DOWNLOADING', 'DEVICE_UNAVAILABLE'],
  ['DEVICE_NO_IMAGE', 'DEVICE_UNAVAILABLE'],
  ['QUOTA_EXCEEDED', 'AI_FAILED'],
  ['APPCHECK_FAILED', 'AI_FAILED'],
  ['AI_BLOCKED', 'AI_FAILED'],
  ['AI_FAILED', 'AI_FAILED'],
  ['AI_TIMEOUT', 'AI_TIMEOUT'],
];

for (const [thrown, shown] of EXTRACT_COPY) {
  test(`SPEC-UI-05, SPEC-CON-01: ${thrown} while extracting shows the ${shown} copy and the code`, async ({
    page,
    fake,
  }) => {
    await fake({ status: 'available+image', errors: { 'extract-contract': thrown } });
    await createProject(page, 'Error page');
    await page.locator('#captures input[type=file]').first().setInputFiles(DESIGN);
    await expect(page.getByText('Desktop design', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Extract contract' }).click();
    await page.getByRole('button', { name: 'Extract contract' }).click();
    // An extraction that failed ran on the device or sent nothing: it never says the cloud was unreachable.
    const copy = shown === 'AI_FAILED' ? uiCopy.flows.extract.failed : stateCopy[shown];
    const notice = page.getByRole('alert').filter({ hasText: copy.title });
    await expect(notice).toBeVisible();
    if (copy.detail) await expect(notice).toContainText(copy.detail);
    await expect(notice.locator('.mono')).toHaveText(shown);
  });
}

test('SPEC-UI-05, SPEC-STO-04: STORAGE_UNAVAILABLE when the browser blocks IndexedDB shows its copy and a Reload action', async ({
  page,
  fake,
}) => {
  await fake({ status: 'available+image' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  });
  await page.goto('/welcome');
  await page.goto('/');
  const copy = stateCopy.STORAGE_UNAVAILABLE;
  const notice = page.getByRole('alert').filter({ hasText: copy.title });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(copy.detail as string);
  await expect(notice.getByRole('button', { name: 'Reload' })).toBeVisible();
});
