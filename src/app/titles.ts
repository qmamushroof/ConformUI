import { copy } from './copy';

// SPEC-APP-04: `document.title` per route, "Run · <project> · ConformUI". Route names are shell chrome, not feature copy.

const SEP = ' · ';

export type RouteKey = 'projects' | 'welcome' | 'project' | 'contract' | 'run' | 'snippet' | 'settings' | 'not-found';

const NAMES: Record<RouteKey, string> = {
  projects: 'Projects',
  welcome: 'Welcome',
  project: 'Project',
  contract: 'Contract',
  run: 'Run',
  snippet: 'DOM snippet',
  settings: 'Settings',
  'not-found': 'Not found',
};

function segments(pathname: string): string[] {
  return pathname.split('/').filter((s) => s !== '');
}

/** Which route of SPEC §4.13.2 a path is. */
export function routeKey(pathname: string): RouteKey {
  const s = segments(pathname);
  if (s.length === 0) return 'projects';
  if (s.length === 1 && s[0] === 'welcome') return 'welcome';
  if (s.length === 1 && s[0] === 'snippet') return 'snippet';
  if (s.length === 1 && s[0] === 'settings') return 'settings';
  if (s[0] === 'p' && s[1]) {
    if (s.length === 2) return 'project';
    if (s.length === 3 && s[2] === 'contract') return 'contract';
    if (s.length === 4 && s[2] === 'run' && s[3]) return 'run';
  }
  return 'not-found';
}

export const routeName = (key: RouteKey): string => NAMES[key];

export function projectIdOf(pathname: string): string | undefined {
  const s = segments(pathname);
  if (s[0] !== 'p' || !s[1]) return undefined;
  try {
    return decodeURIComponent(s[1]);
  } catch {
    return s[1];
  }
}

export function routeTitle(pathname: string, projectName?: string): string {
  const key = routeKey(pathname);
  const name = key === 'project' || key === 'contract' || key === 'run' ? projectName : undefined;
  return [NAMES[key], ...(name ? [name] : []), copy.appName].join(SEP);
}
