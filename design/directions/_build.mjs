// Injects shared SVG defs into *.src.html → *.html
import fs from 'node:fs';
const defs = fs.readFileSync(new URL('./_defs.svg.html', import.meta.url), 'utf8');
for (const f of process.argv.slice(2)) {
  const out = f.replace('.src.html', '.html');
  fs.writeFileSync(out, fs.readFileSync(f, 'utf8').replace('<!--DEFS-->', defs));
  console.log('built', out);
}
