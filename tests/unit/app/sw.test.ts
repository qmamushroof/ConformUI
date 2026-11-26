import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// SPEC-PWA-03, SPEC-PWA-04, SPEC-PWA-05: the service worker's wiring, with workbox stubbed.
const m = vi.hoisted(() => ({
  precacheAndRoute: vi.fn(),
  registerRoute: vi.fn(),
  createHandlerBoundToURL: vi.fn((url: string) => ({ handlerFor: url })),
  NavigationRoute: vi.fn(),
}));
vi.mock('workbox-precaching', () => ({
  precacheAndRoute: m.precacheAndRoute,
  createHandlerBoundToURL: m.createHandlerBoundToURL,
  cleanupOutdatedCaches: vi.fn(),
}));
vi.mock('workbox-routing', () => ({ registerRoute: m.registerRoute, NavigationRoute: m.NavigationRoute }));

type Listener = (e: unknown) => void;
let listeners: Record<string, Listener[]>;
let skipWaiting: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  listeners = {};
  skipWaiting = vi.fn();
  vi.stubGlobal('self', {
    __WB_MANIFEST: [{ url: 'index.html', revision: null }],
    skipWaiting,
    addEventListener: (t: string, l: Listener) => {
      listeners[t] = [...(listeners[t] ?? []), l];
    },
  });
  await import('../../../src/app/sw');
});
afterEach(() => vi.unstubAllGlobals());

describe('service worker', () => {
  it('SPEC-PWA-03: precaches the injected manifest', () => {
    expect(m.precacheAndRoute).toHaveBeenCalledWith([{ url: 'index.html', revision: null }]);
  });
  it('SPEC-PWA-03: one NavigationRoute to index.html with a /share-target denylist', () => {
    expect(m.registerRoute).toHaveBeenCalledTimes(1);
    expect(m.createHandlerBoundToURL).toHaveBeenCalledWith('index.html');
    const opts = (m.NavigationRoute.mock.calls[0] as unknown[])[1] as { denylist: RegExp[] };
    expect(opts.denylist.some((r) => r.test('/share-target'))).toBe(true);
    expect(opts.denylist.some((r) => r.test('/projects'))).toBe(false);
  });
  it('SPEC-PWA-04: no fetch listener, so cross-origin and AI traffic stay network-only', () => {
    expect(listeners.fetch).toBeUndefined();
  });
  it('SPEC-PWA-05: does not skip waiting on install or activate', () => {
    expect(skipWaiting).not.toHaveBeenCalled();
    expect(listeners.install).toBeUndefined();
  });
  it('SPEC-PWA-05: skipWaiting only on a SKIP_WAITING message', () => {
    const onMessage = (listeners.message as Listener[])[0] as Listener;
    onMessage({ data: { type: 'OTHER' } });
    onMessage({ data: null });
    onMessage({});
    expect(skipWaiting).not.toHaveBeenCalled();
    onMessage({ data: { type: 'SKIP_WAITING' } });
    expect(skipWaiting).toHaveBeenCalledTimes(1);
  });
});
