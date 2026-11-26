import { defineConfig } from '@vite-pwa/assets-generator/config';

// SPEC-PWA-01: icons at 48 px and above come from public/icon.svg (a copy of docs/brand/logo.svg).
// The below-48 px favicon.ico comes from public/favicon.svg through scripts/pwa-assets.favicon.config.mjs,
// because one generator config applies a single preset to every image and would overwrite these PNGs.
// SPEC-PWA-01 verified 2026-11-26: the generator emits ONE size per .ico entry (a repeated name keeps only the last),
// so 16 + 32 in one favicon.ico is not possible; favicon.ico ships 32 px only (fallback in 4.1 and SPEC-PWA-01).
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [192, 512], favicons: [] },
    maskable: { sizes: [512], padding: 0.2, resizeOptions: { background: '#FFFFFF' } },
    apple: { sizes: [180] },
  },
  images: ['public/icon.svg'],
});
