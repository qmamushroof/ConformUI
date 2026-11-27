import { defineConfig, devices } from '@playwright/test';

// Cross-browser smoke (SPEC §7): the e2e build on Chromium, Firefox and WebKit, desktop and phone. `CROSS_PORT` picks the port.
const PORT = Number(process.env.CROSS_PORT) || 4174;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'cross-browser.spec.ts',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: `npm run build:e2e && npx vite preview --mode e2e --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
