import { StateNotice } from '@projects';
import { type FC, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { copy, stateCopy } from './copy';
import { AppHeader } from './header';
import { useExternal } from './hooks';
import type { InstallPrompt, UpdateFlow } from './pwa';
import { noticeFor } from './route-boundary';
import { useServices } from './services';
import { projectIdOf, routeTitle } from './titles';

// SPEC-APP-02..04: the layout around every route: header, rejection mapping, document title, update toast.

export interface ShellProps {
  install?: InstallPrompt;
  update?: UpdateFlow;
  /** Production with an invalid environment: show "Configuration error"; the sample and measured checks still work. */
  configError?: boolean;
}

/** SPEC-APP-04 */
function useDocumentTitle(pathname: string): void {
  const { projects } = useServices();
  const id = projectIdOf(pathname);
  const [name, setName] = useState<{ id: string; name: string }>();
  useEffect(() => {
    if (!id) return;
    let live = true;
    projects
      .get(id)
      .then((p) => live && setName(p ? { id, name: p.name } : undefined))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [projects, id]);
  useEffect(() => {
    document.title = routeTitle(pathname, name && name.id === id ? name.name : undefined);
  }, [pathname, name, id]);
}

/** SPEC-APP-03: unhandled rejections map through `CuiError` to a notice, cleared on the next navigation. */
function useRejection(pathname: string): unknown {
  const [rejection, setRejection] = useState<{ reason: unknown } | undefined>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: clears on every navigation.
  useEffect(() => setRejection(undefined), [pathname]);
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setRejection({ reason: (e as PromiseRejectionEvent).reason });
    };
    window.addEventListener('unhandledrejection', on);
    return () => window.removeEventListener('unhandledrejection', on);
  }, []);
  return rejection;
}

/** In-page `#hash` links: the router changes the URL but does not scroll. */
function useHashScroll(pathname: string, hash: string): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls after each navigation to a hash.
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView?.(), 0);
    return () => clearTimeout(t);
  }, [pathname, hash]);
}

const Banner: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="page" style={{ paddingBottom: 0 }}>
    {children}
  </div>
);

const UpdateToast: FC<{ update: UpdateFlow }> = ({ update }) => {
  const ready = useExternal(update.ready, update.subscribe);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {ready ? (
        <div className="toast">
          <span>{copy.update.message}</span>
          <button className="btn btn-ghost" type="button" onClick={() => update.reload()}>
            {copy.update.action}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export const Shell: FC<ShellProps> = ({ install, update, configError }) => {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  useDocumentTitle(pathname);
  useHashScroll(pathname, hash);
  const rejection = useRejection(pathname) as { reason: unknown } | undefined;

  // Plain <a href="/..."> links inside feature components navigate within the app instead of reloading it.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.('a');
      const href = a?.getAttribute('href');
      if (!a || !href || !href.startsWith('/') || href.startsWith('//') || a.target || a.hasAttribute('download'))
        return;
      e.preventDefault();
      navigate(href);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [navigate]);

  const mapped = rejection ? noticeFor(rejection.reason) : undefined;
  return (
    <>
      <AppHeader install={install} />
      {configError ? (
        <Banner>
          <StateNotice notice={stateCopy.CONFIG_ERROR} code="CONFIG_ERROR" />
        </Banner>
      ) : null}
      {mapped ? (
        <Banner>
          <StateNotice notice={{ ...mapped.notice, action: undefined }} code={mapped.code} />
        </Banner>
      ) : null}
      <Outlet />
      {update ? <UpdateToast update={update} /> : null}
    </>
  );
};
