import { Workbox } from 'workbox-window';
import { createInstallPrompt, createUpdateFlow } from './pwa';

// Singletons the header install button and the update toast subscribe to (SPEC-PWA-02, SPEC-PWA-05).
export const installPrompt = createInstallPrompt();

const wb = 'serviceWorker' in navigator && import.meta.env.PROD ? new Workbox('/sw.js') : null;
const inert = { addEventListener: () => undefined, messageSkipWaiting: () => undefined };
export const updateFlow = createUpdateFlow(wb ?? inert);

/** Register after first paint so it never competes with the initial load. */
export function registerServiceWorker(): void {
  if (!wb) return;
  const register = () => void wb.register();
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
