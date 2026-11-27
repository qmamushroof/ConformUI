import { resolve } from 'node:path';
import { expect, test } from './fixtures';
import { createProject, fileBlob, IMAGES, pasteFile, SAMPLE, transfer } from './projects-helpers';

// ROADMAP 14.3, SPEC §7.5 E8 (SPEC-TEST-03): design and capture inputs through the file picker, drop and paste, the
// error copy for bad files, and the viewport suggestion. PRD-F-01, PRD-F-02. The e2e build runs the real codec and
// the real IndexedDB adapter in Chromium; the fake engine only stands in for the AI.

const DESKTOP_DESIGN = resolve(SAMPLE, 'design-desktop.png');
const DESKTOP_SHOT = resolve(SAMPLE, 'flawed-desktop.png'); // 1440 px wide
const MOBILE_SHOT = resolve(SAMPLE, 'flawed-mobile.png'); // 390 px wide
const HINT = 'Use PNG, JPEG or WebP up to 20 MB and 8192 px per side.';

test.beforeEach(async ({ fake }) => {
  await fake({ status: 'available+image' });
});

test.afterEach(({ aiRequests }) => {
  // SPEC-SEC-02: no input path talks to a cloud host, and no consent exists in these flows.
  expect(aiRequests()).toEqual([]);
});

test('PRD-F-01, SPEC-PROJ-01: the file picker adds a Desktop design and the project shows it with its size', async ({
  page,
}) => {
  await createProject(page, 'Picker page');
  await page.locator('#captures input[type=file]').first().setInputFiles(DESKTOP_DESIGN);
  await expect(page.getByText('Desktop design', { exact: true })).toBeVisible();
  await expect(page.getByText(/^\d+ × \d+ · \d+ KB$/).first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('PRD-F-01, SPEC-PROJ-02: dropping an image on the design zone adds it', async ({ page }) => {
  await createProject(page, 'Drop page');
  const dt = await transfer(page, fileBlob(DESKTOP_DESIGN));
  await page.getByRole('button', { name: /Drop the Desktop design/ }).dispatchEvent('drop', { dataTransfer: dt });
  await expect(page.getByText('Desktop design', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Drop the Desktop design/ })).toHaveCount(0);
});

test('PRD-F-01, SPEC-PROJ-02: pasting an image on the design zone adds it', async ({ page }) => {
  await createProject(page, 'Paste design page');
  await pasteFile(page.getByRole('button', { name: /Drop the Desktop design/ }), fileBlob(DESKTOP_DESIGN));
  await expect(page.getByText('Desktop design', { exact: true })).toBeVisible();
});

test('PRD-F-01, SPEC-PROJ-02: a paste outside any zone opens Add capture with the file chosen', async ({ page }) => {
  await createProject(page, 'Paste capture page');
  await pasteFile(page.locator('#captures h2'), fileBlob(DESKTOP_SHOT));
  const sheet = page.getByRole('dialog', { name: 'Add capture' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('flawed-desktop.png')).toBeVisible();
  await sheet.getByRole('button', { name: 'Add capture' }).click();
  await expect(page.getByText('Desktop capture', { exact: true })).toBeVisible();
});

test('PRD-F-01, SPEC-PROJ-02: dropping a capture in the Add capture sheet picks the file', async ({ page }) => {
  await createProject(page, 'Drop capture page');
  await page.getByRole('button', { name: 'Add a Desktop capture' }).click();
  const dt = await transfer(page, fileBlob(DESKTOP_SHOT));
  await page.getByRole('button', { name: /Drop a screenshot/ }).dispatchEvent('drop', { dataTransfer: dt });
  await expect(page.getByText('flawed-desktop.png')).toBeVisible();
  await page.getByRole('button', { name: 'Add capture' }).click();
  await expect(page.getByText('Desktop capture', { exact: true })).toBeVisible();
});

test('PRD-F-02, SPEC-PROJ-03: a 390 px wide image suggests Mobile; the person can change it and the capture lands there', async ({
  page,
}) => {
  await createProject(page, 'Viewport page');
  await page.getByRole('button', { name: 'Add a Desktop capture' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add capture' });
  await sheet.locator('input[type=file]').setInputFiles(MOBILE_SHOT);
  const mobile = sheet.getByRole('radio', { name: /Mobile/ });
  await expect(mobile).toBeChecked();
  await expect(sheet.getByText('Suggested from the image width.')).toBeVisible();
  // The suggestion is only a suggestion: change it to Desktop, then back, and add.
  await sheet.getByRole('radio', { name: /Desktop/ }).check();
  await expect(sheet.getByRole('radio', { name: /Desktop/ })).toBeChecked();
  await mobile.check();
  await sheet.getByRole('button', { name: 'Add capture' }).click();
  await expect(page.getByText('Mobile capture', { exact: true })).toBeVisible();
  await expect(page.getByText('Desktop capture', { exact: true })).toHaveCount(0);
});

test('PRD-F-02, SPEC-PROJ-03: a 1440 px wide image opened from the Mobile column suggests Desktop', async ({
  page,
}) => {
  await createProject(page, 'Desktop suggestion page');
  await page.getByRole('button', { name: 'Add a Mobile capture' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add capture' });
  await sheet.locator('input[type=file]').setInputFiles(DESKTOP_SHOT);
  await expect(sheet.getByRole('radio', { name: /Desktop/ })).toBeChecked();
  await expect(sheet.getByText('Suggested from the image width.')).toBeVisible();
});

test('PRD-F-01, SPEC-PROJ-02, SPEC-UI-05: an unsupported file type shows the not-added notice with the limits', async ({
  page,
}) => {
  await createProject(page, 'Bad type page');
  await page
    .locator('#captures input[type=file]')
    .first()
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('notes.txt was not added: Only PNG, JPEG or WebP images are accepted.');
  await expect(alert).toContainText(HINT);
  await expect(alert).toContainText('For a long page, export the first screen or crop it into parts.');
  await expect(page.getByText('Desktop design', { exact: true })).toHaveCount(0);
});

test('PRD-F-01, SPEC-PROJ-02, SPEC-UI-05: a corrupt PNG says it could not be read and changes nothing', async ({
  page,
}) => {
  await createProject(page, 'Corrupt page');
  await page
    .locator('#captures input[type=file]')
    .first()
    .setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('definitely not a png') });
  await expect(page.getByRole('alert')).toContainText('broken.png was not added: The image could not be read.');
  await expect(page.getByRole('button', { name: /Drop the Desktop design/ })).toBeVisible();
});

test('PRD-F-01, SPEC-PROJ-02, SPEC-UI-05: an image over 8192 px per side is refused with the size limit copy', async ({
  page,
}) => {
  await createProject(page, 'Oversized page');
  await page.locator('#captures input[type=file]').first().setInputFiles(resolve(IMAGES, 'oversized.png'));
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('oversized.png was not added: ');
  await expect(alert).toContainText('8192 px per side');
  await expect(alert).toContainText(HINT);
});

test('PRD-F-01, SPEC-PROJ-02, SPEC-UI-05: a bad capture keeps Add capture open with the error and adds nothing', async ({
  page,
}) => {
  await createProject(page, 'Bad capture page');
  await page.getByRole('button', { name: 'Add a Desktop capture' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add capture' });
  await sheet
    .locator('input[type=file]')
    .setInputFiles({ name: 'shot.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await sheet.getByRole('button', { name: 'Add capture' }).click();
  await expect(sheet.getByRole('alert')).toContainText('shot.gif was not added: Only PNG, JPEG or WebP images');
  await expect(page.getByText('Desktop capture', { exact: true })).toHaveCount(0);
});
