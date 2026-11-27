// Must stay first: it configures zod before anything that imports the kernel builds its schemas (spike D1).
import './zod-jitless';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Boot } from './boot';
import { appEnv } from './env';
import { registerServiceWorker } from './pwa-register';
import './styles/index.css';

// Settings stores the chosen theme under `cui-theme`; apply it before first paint (SPEC-UI-04).
try {
  const t = localStorage.getItem('cui-theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch {
  // Storage blocked: follow the system theme.
}

const result = appEnv();
// SPEC-APP-06: development fails loudly; production shows "Configuration error" and keeps the sample usable.
if (!result.ok && import.meta.env.DEV) throw new Error(`Invalid environment: ${result.issues.join(', ')}`);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <BrowserRouter>
      <Boot env={result.env} configError={!result.ok} />
    </BrowserRouter>,
  );
}
registerServiceWorker();
