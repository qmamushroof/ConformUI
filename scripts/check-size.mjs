// Bundle and asset budgets (SPEC-PERF-04, SPEC-DEMO-06). Usage: node scripts/check-size.mjs [distDir] [sampleDir]
// Exits non-zero when any budget is exceeded. Budgets for things that do not exist yet pass vacuously.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const MB = 1024 * 1024;
const BUDGET = {
  initialJsGzip: 170 * KB, // route `/`, excluding lazy firebase/* chunks
  totalJsGzip: 450 * KB,
  cssGzip: 25 * KB,
  fontFiles: 5, // Latin-subset woff2 only (not counted in JS/CSS budgets)
  samplePng: 1.5 * MB,
  sampleTotal: 8 * MB,
};

const dist = resolve(process.argv[2] ?? 'dist');
const sampleDir = resolve(process.argv[3] ?? 'src/features/demo/sample');

if (!existsSync(dist)) {
  console.error(`check-size: ${dist} not found (run the build first)`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}
const gz = (file) => gzipSync(readFileSync(file)).length;
const rel = (file, base) => relative(base, file).split('\\').join('/');
const kb = (n) => `${(n / KB).toFixed(1)} KB`;
const mb = (n) => `${(n / MB).toFixed(2)} MB`;

const failures = [];
const lines = [];
function budget(name, actual, limit, fmt = kb) {
  const ok = actual <= limit;
  lines.push(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${fmt(actual)} (limit ${fmt(limit)})`);
  if (!ok) failures.push(name);
}
const sum = (fs, f) => fs.reduce((s, x) => s + f(x), 0);

const files = walk(dist);

// Initial JS: scripts and module preloads referenced by index.html, minus lazy firebase chunks.
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+\.js)"[^>]*>/g)].map((m) => m[1]);
const initial = [...new Set(refs)]
  .map((r) => join(dist, r.replace(/^\//, '')))
  .filter((f) => existsSync(f) && !/firebase/i.test(f.split(/[\\/]/).pop() ?? ''));
budget('initial JS (gzip)', sum(initial, gz), BUDGET.initialJsGzip);
budget(
  'total JS (gzip)',
  sum(
    files.filter((f) => extname(f) === '.js'),
    gz,
  ),
  BUDGET.totalJsGzip,
);
budget(
  'CSS (gzip)',
  sum(
    files.filter((f) => extname(f) === '.css'),
    gz,
  ),
  BUDGET.cssGzip,
);

const fonts = files.filter((f) => /\.(woff2?|ttf|otf|eot)$/.test(f));
budget('font files (woff2 only)', fonts.length, BUDGET.fontFiles, String);
const nonWoff2 = fonts.filter((f) => extname(f) !== '.woff2');
if (nonWoff2.length) {
  lines.push(`FAIL non-woff2 fonts: ${nonWoff2.map((f) => rel(f, dist)).join(', ')}`);
  failures.push('non-woff2 fonts');
}

// Sample assets (SPEC-DEMO-06): committed by lane B (9.x). Vacuous until the directory exists.
if (existsSync(sampleDir)) {
  const sample = walk(sampleDir);
  for (const f of sample.filter((p) => extname(p) === '.png')) {
    budget(`sample PNG ${rel(f, sampleDir)}`, statSync(f).size, BUDGET.samplePng, mb);
  }
  budget(
    'sample total',
    sum(sample, (f) => statSync(f).size),
    BUDGET.sampleTotal,
    mb,
  );
} else {
  lines.push(`skip sample assets: ${sampleDir} does not exist yet`);
}

console.log(lines.join('\n'));
if (failures.length) {
  console.error(`check-size: over budget: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('check-size: ok');
