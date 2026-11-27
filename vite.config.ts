import { execSync } from 'node:child_process';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { moduleAliases } from './vite.aliases.ts';

function appVersion(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

// `--mode e2e` builds with the FakeAiEngine seam enabled (SPEC-TEST-01). Production builds define it empty so the
// branch is dead-code-eliminated (SPEC-TEST-02).
export default defineConfig(({ mode }) => ({
  resolve: { alias: moduleAliases(), dedupe: ['react', 'react-dom'] },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion()),
    'import.meta.env.VITE_E2E': JSON.stringify(mode === 'e2e' ? '1' : ''),
  },
  build: {
    rollupOptions: {
      output: {
        // zod and its jitless config share one chunk so the config runs before any kernel schema is built (CSP: no eval probe).
        // React, react-dom and scheduler share one chunk: otherwise the bundler may wrap the CJS React core into two chunks
        // and react-dom and the components end up on different copies ("Cannot read properties of null (reading 'useState')").
        manualChunks: (id: string) => {
          if (id.includes('/node_modules/zod/') || id.endsWith('/src/app/zod-jitless.ts')) return 'zod';
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      registerType: 'prompt',
      srcDir: 'src/app',
      filename: 'sw.ts',
      manifest: {
        id: '/',
        start_url: '/',
        scope: '/',
        name: 'ConformUI: design acceptance testing',
        short_name: 'ConformUI',
        display: 'standalone',
        lang: 'en',
        categories: ['developer', 'productivity', 'utilities'],
        theme_color: '#2563EB',
        background_color: '#FFFFFF',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webp,json}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
}));
