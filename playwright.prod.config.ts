import { defineConfig, devices } from '@playwright/test';

// Smoke of the real production build (`vite build`, no e2e seam) served by `vite preview`. Expects `dist/` to exist.
const PORT = Number(process.env.PROD_PORT) || 4823;

export default defineConfig({
  testDir: 'tests/prod',
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
