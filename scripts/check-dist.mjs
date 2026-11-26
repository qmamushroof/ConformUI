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

if (hits.length) {
  console.error(`check-dist: forbidden content in production build:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`check-dist: ok (no ${[...MARKERS, TOKEN_LABEL].join(', ')})`);
