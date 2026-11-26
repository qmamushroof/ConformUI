import { ProjectsScreen, StateNotice } from '@projects';
import { type ComponentType, type FC, lazy, type ReactNode, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { stateCopy } from './copy';
import { Placeholder, RouteBoundary } from './route-boundary';
import { useServices } from './services';
import { Shell, type ShellProps } from './shell';
import type { RouteKey } from './titles';

// SPEC §4.13.2 routes (react-router library mode). Every screen except `/` is lazy; a route whose lane C or B screen is
// still a Step 0 stub shows a placeholder heading (ROADMAP 7.2) until that screen merges.

type Screen = ComponentType<Record<string, never>>;

export interface ScreenOverrides {
  projects: Screen;
  welcome: Screen;
  settings: Screen;
  snippet: Screen;
  contract: Screen;
  run: Screen;
}

export interface AppRoutesProps extends ShellProps {
  appVersion: string;
  /** Reload button of the route error screen (injectable for tests). */
  onReload?: () => void;
  /** Replaces a route's screen; for tests. */
  screens?: Partial<ScreenOverrides>;
}

const Welcome = lazy(() => import('./screens/welcome'));
const Snippet = lazy(() => import('./screens/snippet'));
const Settings = lazy(() => import('./screens/settings'));
const Contract = lazy(() => import('./screens/contract'));
const Run = lazy(() => import('./screens/run'));

const Loading: FC = () => <main id="main" tabIndex={-1} className="page" aria-busy="true" />;

const reloadPage = () => window.location.reload();

const Guarded: FC<{ route: RouteKey; onReload(): void; children: ReactNode }> = ({ route, onReload, children }) => {
  const { pathname } = useLocation();
  // Keyed by path so a broken route recovers on navigation.
  return (
    <RouteBoundary key={pathname} route={route} onReload={onReload}>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </RouteBoundary>
  );
};

/** `/`: Projects, or Welcome until onboarded (SPEC-SET-08). */
const Home: FC<{ Projects: Screen }> = ({ Projects }) => {
  const { settingsStore } = useServices();
  const [state, setState] = useState<'loading' | 'welcome' | 'ready'>('loading');
  useEffect(() => {
    let live = true;
    settingsStore
      .read()
      .then((s) => live && setState(s.onboarded ? 'ready' : 'welcome'))
      // A storage error surfaces in the screen itself.
      .catch(() => live && setState('ready'));
    return () => {
      live = false;
    };
  }, [settingsStore]);
  if (state === 'loading') return <Loading />;
  if (state === 'welcome') return <Navigate to="/welcome" replace />;
  return <Projects />;
};

const NotFound: FC = () => {
  const navigate = useNavigate();
  return (
    <main id="main" tabIndex={-1} className="page">
      <StateNotice notice={stateCopy.NOT_FOUND} heading onAction={() => navigate('/')} />
    </main>
  );
};

export const AppRoutes: FC<AppRoutesProps> = ({ appVersion, onReload = reloadPage, screens = {}, ...shell }) => {
  const Projects = screens.projects ?? (ProjectsScreen as Screen);
  const guard = (route: RouteKey, node: ReactNode) => (
    <Guarded route={route} onReload={onReload}>
      {node}
    </Guarded>
  );
  const SettingsScreen_ = screens.settings;
  const Welcome_ = screens.welcome ?? Welcome;
  const Snippet_ = screens.snippet ?? Snippet;
  const Contract_ = screens.contract ?? Contract;
  const Run_ = screens.run ?? Run;
  return (
    <Routes>
      <Route element={<Shell {...shell} />}>
        <Route index element={guard('projects', <Home Projects={Projects} />)} />
        <Route path="welcome" element={guard('welcome', <Welcome_ />)} />
        <Route path="p/:projectId" element={guard('project', <Placeholder route="project" />)} />
        <Route path="p/:projectId/contract" element={guard('contract', <Contract_ />)} />
        <Route path="p/:projectId/run/:runId" element={guard('run', <Run_ />)} />
        <Route path="snippet" element={guard('snippet', <Snippet_ />)} />
        <Route
          path="settings"
          element={guard('settings', SettingsScreen_ ? <SettingsScreen_ /> : <Settings appVersion={appVersion} />)}
        />
        <Route path="*" element={guard('not-found', <NotFound />)} />
      </Route>
    </Routes>
  );
};
