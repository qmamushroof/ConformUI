import { defineConfig } from 'vitest/config';
import { moduleAliases } from './vite.aliases';

// Two projects (SPEC §7.1): node for unit + architecture, jsdom for component tests. E2E runs under Playwright.
export default defineConfig({
  resolve: { alias: moduleAliases() },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts', 'tests/architecture/**/*.test.ts'],
          exclude: ['tests/architecture/fixtures/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/component/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
