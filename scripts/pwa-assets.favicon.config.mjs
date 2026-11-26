// SPEC-PWA-01: the below-48 px favicon.ico, generated from public/favicon.svg only (run by `npm run icons`).
// One size per .ico: the generator keeps a single entry per file name, so only the 32 px entry is emitted.
export default {
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [], favicons: [[32, 'favicon.ico']] },
    maskable: { sizes: [] },
    apple: { sizes: [] },
  },
  images: ['public/favicon.svg'],
};
