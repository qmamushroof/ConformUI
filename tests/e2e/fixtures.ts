import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared E2E harness (ROADMAP 14.0). Other specs import `test` and `expect` from './fixtures' and never edit this file.
 *
 * The app under test is the `--mode e2e` build served by `vite preview` (see playwright.config.ts `webServer`), which
 * composes the FakeAiEngine and skips Firebase (SPEC-APP-01); use `page.goto('/')` with the configured baseURL.
 *
 * Fixtures:
 * - `fake(config)`: selects the SPEC §7.2 scenario (`status`: a scenario name or a partial EngineStatus, plus
 *   `online`, `outputs`, `errors`, `durationMs`, `inferenceSource`) before any page script runs. Call it before
 *   `page.goto`. Calling it again replaces the config for subsequent navigations.
 * - `fakeCalls()`: the fake's `window.__CUI_FAKE__.calls[]` (every AiRequest, rejected ones included).
 * - `aiRequests()`: URLs of every request seen so far to a Google AI/Firebase host (SPEC-PWA-04, SPEC-SEC-08).
 *   Expect `[]` with the fake (SPEC-SEC-02, PRD-M-06). The spy is installed on the page automatically.
 */

export interface FakeConfig {
  status?: string | Record<string, unknown>;
  online?: boolean;
  outputs?: Record<string, unknown>;
  errors?: Record<string, string>;
  durationMs?: number;
  /** Real milliseconds the fake waits before answering or failing (slow cloud). */
  delayMs?: number;
  inferenceSource?: 'on-device' | 'cloud';
}

/** Hosts from SPEC-SEC-08 `connect-src` plus any `*.googleapis.com`. */
const AI_HOST = /(^|\.)googleapis\.com$|(^|\.)gstatic\.com$|^www\.google\.com$/;

export const isAiRequestUrl = (url: string): boolean => {
  try {
    return AI_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

interface Fixtures {
  fake: (config?: FakeConfig) => Promise<void>;
  fakeCalls: () => Promise<unknown[]>;
  aiRequests: () => string[];
}

export const test = base.extend<Fixtures>({
  aiRequests: async ({ page }, use) => {
    const seen: string[] = [];
    page.on('request', (req) => {
      if (isAiRequestUrl(req.url())) seen.push(req.url());
    });
    await use(() => [...seen]);
  },
  fake: async ({ page }, use) => {
    await use(async (config = {}) => {
      await page.addInitScript((c) => {
        (window as unknown as { __CUI_FAKE__: unknown }).__CUI_FAKE__ = c;
      }, config);
    });
  },
  fakeCalls: async ({ page }, use) => {
    await use(readCalls.bind(null, page));
  },
});

const readCalls = (page: Page): Promise<unknown[]> =>
  page.evaluate(() => [...((window as unknown as { __CUI_FAKE__?: { calls?: unknown[] } }).__CUI_FAKE__?.calls ?? [])]);

export { expect };
