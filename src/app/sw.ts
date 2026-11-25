/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

// Placeholder service worker (SPEC §4.13.4). Lane A (task 7.x) adds navigation fallback, update flow and caching rules.
declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
