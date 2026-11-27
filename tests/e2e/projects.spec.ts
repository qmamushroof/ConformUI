import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { createProject, openProjects, SAMPLE } from './projects-helpers';

// ROADMAP 14.3, SPEC §7.5 E9 (SPEC-TEST-03): projects are created, persist across a reload, and a delete removes the
// project with its images, contract and runs. PRD-F-01, SPEC-PROJ-05, SPEC-STO-*. Real IndexedDB in Chromium.

const BIG = { timeout: 60_000 };
const DESKTOP_DESIGN = resolve(SAMPLE, 'design-desktop.png');
const DESKTOP_SHOT = resolve(SAMPLE, 'flawed-desktop.png');

type Counts = Record<'projects' | 'contracts' | 'runs' | 'blobs', number>;

/** Row counts of the app's IndexedDB stores (SPEC §4.2). */
const counts = (page: Page): Promise<Counts> =>
  page.evaluate(
    () =>
      new Promise<Counts>((done, fail) => {
        const open = indexedDB.open('conformui');
        open.onerror = () => fail(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = ['projects', 'contracts', 'runs', 'blobs'] as const;
          const tx = db.transaction([...names], 'readonly');
          const out = {} as Counts;
          for (const n of names) {
            const r = tx.objectStore(n).count();
            r.onsuccess = () => {
              out[n] = r.result;
            };
          }
          tx.oncomplete = () => {
            db.close();
            done(out);
          };
          tx.onerror = () => fail(tx.error);
        };
      }),
  );

const deleteProject = async (page: Page, name: string) => {
  await page.getByRole('button', { name: `More actions for ${name}` }).click();
  await page.getByRole('button', { name: 'Delete…' }).click();
  const sheet = page.getByRole('dialog', { name: `Delete project “${name}”?` });
  await expect(sheet).toBeVisible();
  return sheet;
};

test.beforeEach(async ({ fake }) => {
  await fake({ status: 'available+image' });
});

test.afterEach(({ aiRequests }) => {
  expect(aiRequests()).toEqual([]); // SPEC-SEC-02
});

test('PRD-F-01, SPEC-PROJ-05: a created project, its design and its capture persist across a reload', async ({
  page,
}) => {
  await createProject(page, 'Persistent page');
  await page.locator('#captures input[type=file]').first().setInputFiles(DESKTOP_DESIGN);
  await expect(page.getByText('Desktop design', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add a Desktop capture' }).click();
  await page.getByRole('dialog', { name: 'Add capture' }).locator('input[type=file]').setInputFiles(DESKTOP_SHOT);
  await page.getByRole('button', { name: 'Add capture' }).click();
  await expect(page.getByText('Desktop capture', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Persistent page' })).toBeVisible();
  await expect(page.getByText('Desktop design', { exact: true })).toBeVisible();
  await expect(page.getByText('Desktop capture', { exact: true })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Projects' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Persistent page' })).toBeVisible();
  await expect(page.getByText('1 project, stored on this device')).toBeVisible();
});

test('PRD-F-01, SPEC-PROJ-05: a renamed project keeps its new name after a reload', async ({ page }) => {
  await createProject(page, 'Old name');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Projects' }).click();
  await page.getByRole('button', { name: 'More actions for Old name' }).click();
  await page.getByRole('button', { name: 'Rename' }).click();
  await page.getByLabel('Project name').fill('New name');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Renamed to New name')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'New name' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Old name' })).toHaveCount(0);
});

test('PRD-F-01, SPEC-PROJ-05: delete needs the typed name, then removes the project after a reload too', async ({
  page,
}) => {
  await createProject(page, 'Doomed page');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Projects' }).click();
  const sheet = await deleteProject(page, 'Doomed page');
  const confirm = sheet.getByRole('button', { name: 'Delete project' });
  await expect(confirm).toHaveAttribute('aria-disabled', 'true');
  await confirm.click({ force: true }); // aria-disabled: Playwright would wait; the name does not match, nothing is deleted
  await expect(sheet).toBeVisible();
  expect((await counts(page)).projects).toBe(1);
  await sheet.getByLabel(/^Type .* to confirm$/).fill('Doomed page');
  await expect(confirm).toHaveAttribute('aria-disabled', 'false');
  await confirm.click();
  await expect(page.getByText('Deleted Doomed page')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'No projects yet' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'No projects yet' })).toBeVisible();
});

test('PRD-F-01, SPEC-PROJ-05: deleting a project removes its images, contract and runs and leaves other projects alone', async ({
  page,
}) => {
  // The sample has designs, captures, a contract and (after a Run) a run; Keeper has one image of its own.
  await createProject(page, 'Keeper');
  await page.locator('#captures input[type=file]').first().setInputFiles(DESKTOP_DESIGN);
  await expect(page.getByText('Desktop design', { exact: true })).toBeVisible();
  const keeper = await counts(page);
  expect(keeper).toMatchObject({ projects: 1, contracts: 0, runs: 0, blobs: 1 });

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Projects' }).click();
  await page.getByRole('link', { name: 'Try the sample' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sample landing page' })).toBeVisible(BIG);
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Run 1' })).toBeVisible(BIG);
  const both = await counts(page);
  expect(both.projects).toBe(2);
  expect(both.contracts).toBeGreaterThanOrEqual(1);
  expect(both.runs).toBe(1);
  expect(both.blobs).toBeGreaterThan(keeper.blobs);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Projects' }).click();
  const sheet = await deleteProject(page, 'Sample landing page');
  await expect(sheet.getByText('1 run')).toBeVisible();
  await sheet.getByLabel(/^Type .* to confirm$/).fill('Sample landing page');
  await sheet.getByRole('button', { name: 'Delete project' }).click();
  await expect(page.getByText('Deleted Sample landing page')).toBeVisible();

  expect(await counts(page)).toEqual({ projects: 1, contracts: 0, runs: 0, blobs: keeper.blobs });
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Keeper' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Sample landing page' })).toHaveCount(0);
});

test('SPEC-PROJ-05, SPEC-UI-05: Cancel keeps the project', async ({ page }) => {
  await createProject(page, 'Kept page');
  await openProjects(page);
  const sheet = await deleteProject(page, 'Kept page');
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Kept page' })).toBeVisible();
});
