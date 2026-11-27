// Production build must not contain test seams or an App Check debug-token assignment (SPEC-TEST-02, SPEC-FB-04).
// The App Check SDK itself reads the debug-token global, so only an assignment to it is forbidden.
// Usage: node scripts/check-dist.mjs [distDir]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const MARKERS = ['__CUI_FAKE__', 'FakeAiEngine'];
// `.TOKEN =`, `["TOKEN"] =`, and `||=` / `&&=` / `??=`; `==`, `===`, `!=`, `!==` are reads.
const TOKEN_ASSIGN = /FIREBASE_APPCHECK_DEBUG_TOKEN["']?\]?\s*(?:\|\||&&|\?\?)?=(?!=)/;
const TOKEN_LABEL = 'assignment to FIREBASE_APPCHECK_DEBUG_TOKEN';
const dist = resolve(process.argv[2] ?? 'dist');

if (!existsSync(dist)) {
  console.error(`check-dist: ${dist} not found (run the build first)`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

const hits = [];
for (const file of walk(dist)) {
  const text = readFileSync(file, 'latin1');
  for (const marker of MARKERS) {
    if (text.includes(marker)) hits.push(`${relative(dist, file)}: ${marker}`);
  }
  if (TOKEN_ASSIGN.test(text)) hits.push(`${relative(dist, file)}: ${TOKEN_LABEL}`);
}

// No Tailwind preflight: its `*{margin:0}` reset un-centres every modal dialog (UA `dialog:modal{margin:auto}`).
for (const file of walk(dist).filter((f) => f.endsWith('.css'))) {
  const css = readFileSync(file, 'utf8');
  if (css.includes('--tw-')) hits.push(`${relative(dist, file)}: Tailwind variable --tw-`);
  for (const m of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const universal = (m[1] ?? '').split(',').some((s) => /^\s*\*\s*$/.test(s) || /^\s*::?backdrop\s*$/.test(s));
    if (universal && /(^|;)\s*margin\s*:\s*0\s*(;|$)/.test(m[2] ?? ''))
      hits.push(`${relative(dist, file)}: universal reset (margin:0 on *)`);
  }
}

// One React copy: its core (marked by `isReactComponent={}`) must live in exactly one chunk, and react-dom must import it.
const REACT_CORE = 'isReactComponent={}';
const assets = join(dist, 'assets');
if (existsSync(assets)) {
  const js = readdirSync(assets).filter((f) => f.endsWith('.js'));
  const owners = js.filter((f) => readFileSync(join(assets, f), 'latin1').includes(REACT_CORE));
  if (owners.length > 1) hits.push(`React core defined in ${owners.length} chunks (${owners.join(', ')}), expected 1`);
  else if (owners.length === 1) {
    const dom = js.filter((f) => readFileSync(join(assets, f), 'latin1').includes('currentDispatcherRef'));
    for (const f of dom) {
      if (f !== owners[0] && !readFileSync(join(assets, f), 'latin1').includes(owners[0]))
        hits.push(`${f}: react-dom does not import the React core chunk ${owners[0]}`);
    }
  }
}

if (hits.length) {
  console.error(`check-dist: forbidden content in production build:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`check-dist: ok (no ${[...MARKERS, TOKEN_LABEL].join(', ')})`);
