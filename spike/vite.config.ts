import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import { moduleAliases } from '../vite.aliases.ts';

// THROWAWAY spike config (branch spike/hybrid, never merged, never pushed).
const here = fileURLToPath(new URL('.', import.meta.url));
const RESULTS = `${here}results.jsonl`;
const MAIN_CHECKOUT = 'C:/Users/SN-LP-64/source/repos/qmamushroof/ConformUI'; // holds the real .env.local

// SPEC-SEC-08, verbatim.
const CSP =
  "default-src 'self'; script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src https://www.google.com/recaptcha/; connect-src 'self' data: https://firebasevertexai.googleapis.com https://firebaseremoteconfig.googleapis.com https://firebaseinstallations.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.google.com; object-src 'none'; base-uri 'none'; form-action 'self'";

function spikeEndpoint(opts: { csp: boolean }): Plugin {
  type Mw = (req: any, res: any, next: () => void) => void;
  const mw: Mw = (req, res, next) => {
    const url = (req.url as string).split('?')[0];
    if (url === '/__spike/record' && req.method === 'POST') {
      let body = '';
      req.on('data', (c: Buffer) => {
        body += c;
        if (body.length > 2_000_000) req.destroy();
      });
      req.on('end', () => {
        try {
          const rec = JSON.parse(body);
          appendFileSync(RESULTS, `${JSON.stringify(rec)}\n`);
          res.statusCode = 204;
        } catch {
          res.statusCode = 400;
        }
        res.end();
      });
      return;
    }
    if (url === '/__spike/results' && req.method === 'GET') {
      res.setHeader('content-type', 'text/plain');
      res.end(existsSync(RESULTS) ? readFileSync(RESULTS, 'utf8') : '');
      return;
    }
    next();
  };
  const cspMw: Mw = (_req, res, next) => {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  };
  return {
    name: 'spike-endpoint',
    configureServer(s) {
      s.middlewares.use(mw);
    },
    configurePreviewServer(s) {
      if (opts.csp) s.middlewares.use(cspMw);
      s.middlewares.use(mw);
    },
  };
}

// dev:     vite --config spike/vite.config.ts                    (http://localhost:5173, no CSP, DEV=true)
// preview: vite build --config spike/vite.config.ts && vite preview --config spike/vite.config.ts
//          (http://localhost:5173 too: the API key referrer restriction allows only that origin; CSP header on)
export default defineConfig(({ command }) => ({
  root: here,
  envDir: MAIN_CHECKOUT,
  resolve: { alias: moduleAliases() },
  // The product only enables the App Check debug provider when import.meta.env.DEV. A production build has DEV=false,
  // so for the CSP preview build ONLY we force it on (spike scratch code; product code is untouched).
  define: command === 'build' ? { 'import.meta.env.DEV': 'true' } : {},
  server: { port: 5173, strictPort: true, fs: { allow: [`${here}..`] } },
  preview: { port: 5173, strictPort: true },
  build: { outDir: `${here}dist`, emptyOutDir: true, target: 'es2023', sourcemap: false },
  plugins: [spikeEndpoint({ csp: true })],
}));
