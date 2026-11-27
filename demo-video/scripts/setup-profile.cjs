// Creates the DEDICATED Chrome profile (chrome-profile\) used for recording.
// Copies ONLY on-device model component folders + the optimization_guide model metadata from the owner's Chrome.
// Never copies cookies, logins, history or any Default\ profile data.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '..');
const dst = path.join(root, 'chrome-profile');
const src = path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data');
fs.mkdirSync(dst, { recursive: true });
const ls = JSON.parse(fs.readFileSync(path.join(src, 'Local State'), 'utf8'));
const mine = fs.existsSync(path.join(dst, 'Local State')) ? JSON.parse(fs.readFileSync(path.join(dst, 'Local State'), 'utf8')) : {};
mine.browser = mine.browser || {};
mine.browser.enabled_labs_experiments = ['gemma4-for-built-in-ai@1', 'prompt-api-multimodal-input@1'];
mine.optimization_guide = ls.optimization_guide; // model store metadata only
mine.on_device_model = ls.on_device_model;
fs.writeFileSync(path.join(dst, 'Local State'), JSON.stringify(mine));
for (const d of ['OptGuideOnDeviceModel', 'OptGuideManifestModel', 'OptGuidePredictionModels']) {
  if (!fs.existsSync(path.join(src, d))) continue;
  console.log('copy', d);
  cp.spawnSync('robocopy', [path.join(src, d), path.join(dst, d), '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/MT:8'], { stdio: 'inherit' });
}
console.log('profile ready:', dst);
