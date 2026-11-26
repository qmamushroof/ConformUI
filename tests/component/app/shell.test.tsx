import 'fake-indexeddb/auto';
import { CuiError } from '@kernel';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes, type AppRoutesProps } from '../../../src/app/routes';
import { ServicesProvider } from '../../../src/app/services';
import { createFakeAiEngine, type FakeAiConfig } from '../../../src/app/testing/fake-ai-engine';
import { composeForTest } from '../../../tests/helpers/compose-test';

afterEach(() => {
  cleanup();
  document.title = '';
});

const Probe: ComponentType = () => {
  const l = useLocation();
  return <output data-testid="loc">{l.pathname}</output>;
};
const Named =
  (name: string): ComponentType =>
  () => (
    <main id="main" tabIndex={-1} className="page">
      <h1>{name} screen</h1>
    </main>
  );
const Boom =
  (e: unknown): ComponentType =>
  () => {
    throw e;
  };

interface Mount extends Partial<AppRoutesProps> {
  path?: string;
  fake?: FakeAiConfig;
  onboarded?: boolean;
  everSent?: boolean;
}

async function mount(o: Mount = {}) {
  const cfg: FakeAiConfig = o.fake ?? {};
  const { services } = await composeForTest({ ai: createFakeAiEngine(cfg, {}) });
  await services.settingsStore.write({ onboarded: o.onboarded ?? true, everSentToCloud: o.everSent ?? false });
  const { path, fake: _f, onboarded: _o, everSent: _e, ...props } = o;
  const view = render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[path ?? '/']}>
        <AppRoutes appVersion="test" onReload={vi.fn()} {...props} />
        <Probe />
      </MemoryRouter>
    </ServicesProvider>,
  );
  return { services, cfg, view };
}

const screens = {
  projects: Named('Projects'),
  contract: Named('Contract'),
  run: Named('Run'),
  snippet: Named('Snippet'),
};

describe('routes', () => {
  it('SPEC-APP-02, SPEC-SET-08: "/" redirects to /welcome until onboarded', async () => {
    await mount({ screens, onboarded: false });
    expect(await screen.findByRole('heading', { level: 1, name: 'Check a page against its design' })).toBeTruthy();
    expect(screen.getByTestId('loc').textContent).toBe('/welcome');
    expect(document.title).toBe('Welcome · ConformUI');
  });

  it('SPEC-APP-02: "/" renders Projects once onboarded, with no redirect', async () => {
    await mount({ screens, onboarded: true });
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects screen' })).toBeTruthy();
    expect(screen.getByTestId('loc').textContent).toBe('/');
    expect(document.title).toBe('Projects · ConformUI');
  });

  it('SPEC-APP-02: /settings is lazy-loaded and renders the Settings screen with the header around it', async () => {
    await mount({ path: '/settings' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(document.title).toBe('Settings · ConformUI');
  });

  it.each([
    ['/snippet', 'Snippet screen', 'DOM snippet · ConformUI'],
    ['/p/x/contract', 'Contract screen', 'Contract · ConformUI'],
    ['/p/x/run/r1', 'Run screen', 'Run · ConformUI'],
  ])('SPEC-APP-02: %s mounts its screen lazily and titles the page', async (path, heading, title) => {
    await mount({ path, screens });
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeTruthy();
    expect(document.title).toBe(title);
  });

  it('SPEC-APP-04: the title carries the project name once it is known', async () => {
    const { services } = await mount({ path: '/', screens });
    const p = await services.projects.create('Checkout');
    cleanup();
    render(
      <ServicesProvider services={services}>
        <MemoryRouter initialEntries={[`/p/${p.id}/run/r1`]}>
          <AppRoutes appVersion="test" screens={screens} onReload={vi.fn()} />
        </MemoryRouter>
      </ServicesProvider>,
    );
    await waitFor(() => expect(document.title).toBe('Run · Checkout · ConformUI'));
  });

  it('SPEC-APP-02: an unknown path shows the not-found notice with a way home, under the header', async () => {
    await mount({ path: '/nope', screens });
    expect(await screen.findByRole('heading', { level: 1, name: "This page doesn't exist." })).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(document.title).toBe('Not found · ConformUI');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Projects' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects screen' })).toBeTruthy();
  });

  it('SPEC-APP-02: exactly one main landmark per route, including the not-found and placeholder routes', async () => {
    await mount({ path: '/nope', screens });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('SPEC-APP-02: a screen that is still a Step 0 stub renders a placeholder heading, not an error', async () => {
    await mount({ path: '/snippet', screens: { snippet: Boom(new Error('not implemented')) } });
    expect(await screen.findByRole('heading', { level: 1, name: 'DOM snippet' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});

describe('error handling', () => {
  it('SPEC-APP-03: a throwing screen shows the plain-language route error with Reload, never the raw message', async () => {
    const onReload = vi.fn();
    await mount({ path: '/snippet', screens: { snippet: Boom(new Error('secret user content')) }, onReload });
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Something went wrong on this screen/)).toBeTruthy();
    expect(alert.textContent).not.toContain('secret user content');
    expect(within(alert).getByText('ROUTE_ERROR')).toBeTruthy();
    fireEvent.click(within(alert).getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('SPEC-APP-03, SPEC-KERNEL-09: a CuiError thrown by a screen maps to its own copy and shows its code', async () => {
    await mount({ path: '/snippet', screens: { snippet: Boom(new CuiError('OFFLINE')) } });
    const alert = await screen.findByText(/You're offline/);
    expect(alert).toBeTruthy();
    expect(screen.getByText('OFFLINE')).toBeTruthy();
  });

  it('SPEC-APP-03: navigating away from a broken route clears the error', async () => {
    await mount({ path: '/snippet', screens: { snippet: Boom(new Error('x')), projects: Named('Projects') } });
    await screen.findByRole('alert');
    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Projects' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects screen' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('SPEC-APP-03: an unhandled rejection maps through CuiError to a StateNotice and is not left unhandled', async () => {
    await mount({ screens });
    await screen.findByRole('heading', { level: 1, name: 'Projects screen' });
    const ev = Object.assign(new Event('unhandledrejection', { cancelable: true }), {
      reason: new CuiError('DAILY_CAP'),
    });
    act(() => {
      window.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    expect(await screen.findByText('DAILY_CAP')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('SPEC-APP-03: an unhandled rejection of an unknown error shows the generic route error without its message', async () => {
    await mount({ screens });
    await screen.findByRole('heading', { level: 1, name: 'Projects screen' });
    act(() => {
      window.dispatchEvent(Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason: 'private' }));
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('private');
    expect(within(alert).getByText('ROUTE_ERROR')).toBeTruthy();
  });

  it('SPEC-APP-06: a configuration error is shown above the screens, which keep working', async () => {
    await mount({ screens, configError: true });
    expect(await screen.findByText('Configuration error')).toBeTruthy();
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects screen' })).toBeTruthy();
  });
});

describe('header', () => {
  it('SPEC-APP-02: logo and name link home; nav lists Projects, Snippet, Settings with the current one marked', async () => {
    await mount({ path: '/settings', screens });
    const banner = await screen.findByRole('banner');
    const brand = within(banner).getByRole('link', { name: 'ConformUI, projects' });
    expect(brand.getAttribute('href')).toBe('/');
    const nav = within(banner).getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Projects', 'Snippet', 'Settings']);
    expect(links.map((l) => l.getAttribute('aria-current'))).toEqual([null, null, 'page']);
  });

  it('SPEC-APP-02: Projects stays current inside a project; Snippet is current on /snippet', async () => {
    await mount({ path: '/p/x/contract', screens });
    const nav = within(await screen.findByRole('banner')).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Projects' }).getAttribute('aria-current')).toBe('page');
  });

  it('SPEC-APP-02: the header is on every route, including welcome and not-found', async () => {
    await mount({ path: '/welcome', screens, onboarded: false });
    expect(await screen.findByRole('banner')).toBeTruthy();
  });

  it.each([
    ['available+image', 'On-device ready'],
    ['unavailable-not-desktop-chrome', 'Cloud with consent'],
    ['downloadable', 'Cloud with consent'],
  ] as const)('SPEC-APP-02: engine pill for %s reads "%s"', async (status, text) => {
    await mount({ screens, fake: { status } });
    const pill = await screen.findByRole('link', { name: new RegExp(`Engine: ${text}`) });
    expect(pill.getAttribute('href')).toBe('/settings#engine');
    expect(within(pill).getByText(text)).toBeTruthy();
  });

  it('SPEC-APP-02: with the cloud disabled and no device model the pill reads "Measured only"', async () => {
    await mount({ screens, fake: { status: { device: 'unavailable', deviceImage: false, cloud: 'disabled' } } });
    expect(await screen.findByRole('link', { name: /Engine: Measured only/ })).toBeTruthy();
  });

  it('SPEC-APP-02: offline mode hides the cloud from the pill even when the cloud flag is on', async () => {
    await mount({ screens, fake: { status: 'unavailable-not-desktop-chrome', online: false } });
    expect(await screen.findByRole('link', { name: /Engine: Measured only/ })).toBeTruthy();
  });

  it('SPEC-APP-02: the Offline pill follows the browser online and offline events', async () => {
    const { cfg } = await mount({ screens });
    await screen.findByRole('banner');
    expect(screen.queryByText('Offline')).toBeNull();
    cfg.online = false;
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(await screen.findByText('Offline')).toBeTruthy();
    cfg.online = true;
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(screen.queryByText('Offline')).toBeNull());
  });

  it('SPEC-SET-06: the privacy counter says nothing left the device until something was sent', async () => {
    await mount({ screens, everSent: false });
    expect(await screen.findByRole('link', { name: 'Privacy: Nothing has left this device' })).toBeTruthy();
  });

  it('SPEC-SET-06: after a cloud send the header sums requests and bytes across projects', async () => {
    const { services } = await mount({ screens, everSent: true });
    const a = await services.projects.create('A');
    const b = await services.projects.create('B');
    await services.projects.recordCloudUsage(a.id, 1024);
    await services.projects.recordCloudUsage(b.id, 1024);
    cleanup();
    render(
      <ServicesProvider services={services}>
        <MemoryRouter>
          <AppRoutes appVersion="t" screens={screens} onReload={vi.fn()} />
        </MemoryRouter>
      </ServicesProvider>,
    );
    expect(await screen.findByRole('link', { name: 'Privacy: Cloud: 2 requests · 2 KB' })).toBeTruthy();
  });

  it('SPEC-SET-06: inside a project the counter is that project only, with the idle project text at 0 requests', async () => {
    const { services } = await mount({ screens, everSent: true });
    const a = await services.projects.create('A');
    const b = await services.projects.create('B');
    await services.projects.recordCloudUsage(a.id, 2048);
    cleanup();
    render(
      <ServicesProvider services={services}>
        <MemoryRouter initialEntries={[`/p/${a.id}/run/r`]}>
          <AppRoutes appVersion="t" screens={screens} onReload={vi.fn()} />
        </MemoryRouter>
      </ServicesProvider>,
    );
    expect(await screen.findByRole('link', { name: 'Privacy: Cloud: 1 request · 2 KB this project' })).toBeTruthy();
    cleanup();
    render(
      <ServicesProvider services={services}>
        <MemoryRouter initialEntries={[`/p/${b.id}`]}>
          <AppRoutes appVersion="t" screens={screens} onReload={vi.fn()} />
        </MemoryRouter>
      </ServicesProvider>,
    );
    expect(
      await screen.findByRole('link', { name: 'Privacy: Nothing from this project has left this device' }),
    ).toBeTruthy();
  });

  it('SPEC-PWA-02: "Install app" appears only while the browser offers it and runs the prompt on click', async () => {
    let can = false;
    const listeners = new Set<() => void>();
    const install = {
      canInstall: () => can,
      subscribe: (l: () => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      install: vi.fn(async () => 'accepted' as const),
    };
    await mount({ screens, install });
    await screen.findByRole('banner');
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();
    can = true;
    act(() => {
      for (const l of listeners) l();
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Install app' }));
    expect(install.install).toHaveBeenCalledTimes(1);
  });

  it('SPEC-PWA-05: the update toast appears when a new version waits and Reload is the only trigger', async () => {
    let ready = false;
    const listeners = new Set<() => void>();
    const update = {
      ready: () => ready,
      subscribe: (l: () => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      reload: vi.fn(),
    };
    await mount({ screens, update });
    await screen.findByRole('banner');
    expect(screen.queryByText('A new version is ready.')).toBeNull();
    ready = true;
    act(() => {
      for (const l of listeners) l();
    });
    expect(await screen.findByText('A new version is ready.')).toBeTruthy();
    expect(update.reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(update.reload).toHaveBeenCalledTimes(1);
  });

  it('SPEC-APP-02: the mobile menu button toggles the mobile navigation', async () => {
    await mount({ screens });
    const btn = await screen.findByRole('button', { name: 'Menu' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(btn.getAttribute('aria-controls') ?? '')?.classList.contains('open')).toBe(true);
  });
});
