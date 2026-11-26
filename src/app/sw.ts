/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

// Service worker (SPEC §4.13.4). Precache only: no runtime caching, so cross-origin and AI traffic stay network-only
// (SPEC-PWA-04). The only route is the navigation fallback to the app shell (SPEC-PWA-03).
declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/share-target/] }));

// SPEC-PWA-05: a new worker waits; it activates only when the page asks after the user clicks Reload.
self.addEventListener('message', (event) => {
  if ((event as ExtendableMessageEvent).data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
