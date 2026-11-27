import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';

// Helpers shared by the 14.3 specs (inputs, projects, settings). fixtures.ts is not edited (ROADMAP 14.0).

export const IMAGES = resolve('tests/fixtures/images');
export const SAMPLE = resolve('src/features/demo/sample');

export interface FileBlob {
  b64: string;
  name: string;
  type: string;
}

export const fileBlob = (path: string, type = 'image/png'): FileBlob => ({
  b64: readFileSync(path).toString('base64'),
  name: path.split(/[\\/]/).pop() as string,
  type,
});

/** A DataTransfer holding the file, built in the page, as a drop or paste carries it. */
export const transfer = (page: Page, f: FileBlob) =>
  page.evaluateHandle(({ b64, name, type }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], name, { type }));
    return dt;
  }, f);

/** Pastes the file onto the element as a real ClipboardEvent (Playwright's dispatchEvent builds a plain Event for paste). */
export const pasteFile = (target: Locator, f: FileBlob) =>
  target.evaluate((el, { b64, name, type }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], name, { type }));
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, f);

/** Opens Projects (skipping Welcome on a first visit). */
export async function openProjects(page: Page) {
  await page.goto('/');
  const start = page.getByRole('button', { name: 'Start a project' });
  const projects = page.getByRole('heading', { level: 1, name: 'Projects' });
  await start.or(projects).first().waitFor(); // the first visit redirects to Welcome after the first paint
  if (await start.isVisible()) await start.click();
  await expect(projects).toBeVisible();
}

/** Projects -> New project sheet -> the new project's page. */
export async function createProject(page: Page, name: string) {
  await openProjects(page);
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByLabel('Project name').fill(name);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}
