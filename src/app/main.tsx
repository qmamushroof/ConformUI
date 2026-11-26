import { createRoot } from 'react-dom/client';
import { copy } from './copy';
import { registerServiceWorker } from './pwa-register';
import './styles/index.css';

// Placeholder shell (lane A, task 7.x replaces it with the composition root and routes).
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<main>{copy.appName}</main>);
}
registerServiceWorker();
