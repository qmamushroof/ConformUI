import { defineConfig, devices } from '@playwright/test';

// `E2E_PORT` lets parallel local runs use different preview ports; CI keeps the default.
const PORT = Number(process.env.E2E_PORT) || 4173;

// E2E runs against the `--mode e2e` build served by `vite preview` (SPEC §7.1). Real AI is never called (FakeAiEngine).
export default defineConfig({
  testDir: 'tests/e2e',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build:e2e && npx vite preview --mode e2e --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
