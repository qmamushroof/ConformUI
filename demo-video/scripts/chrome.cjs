const path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
exports.root = root;
// AI=true: dedicated profile with Gemma 4 flags. AI=false: fresh temp profile, no AI flags.
exports.launch = async function ({ ai = true, width = 1920, height = 1080, dsf = 1, mobile = false, video = null, profile = null }) {
  const userDataDir = profile || path.join(root, ai ? 'chrome-profile' : 'chrome-profile-noai');
  const args = ['--user-data-dir=' + userDataDir, '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=' + dsf,
    '--window-size=' + width + ',' + (height + 140), '--window-position=0,0'];
  if (!ai) args.push('--disable-features=OptimizationGuideOnDeviceModel,PromptAPIForGeminiNano,PromptApiForGemma4');
  if (ai) args.push('--enable-features=OptimizationGuideOnDeviceModel,PromptAPIForGeminiNano,PromptApiForGemma4,PromptAPIMultimodalInput');
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome', headless: false, ignoreDefaultArgs: true, args,
    viewport: { width, height }, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile,
    recordVideo: video ? { dir: video, size: { width, height } } : undefined,
  });
};
