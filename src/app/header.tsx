import { PrivacyCounter } from '@settings';
import { type FC, useId, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { copy } from './copy';
import { type EnginePill, enginePill, useEngineView, useExternal, usePrivacyTotals } from './hooks';
import type { InstallPrompt } from './pwa';
import { projectIdOf } from './titles';

// SPEC-APP-02: header on every route. Markup and classes follow design/prototype (`renderShell` in assets/app.js).

const ICONS = {
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  cloud: 'M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 18z',
  ruler: 'M2 8h20v8H2zM6 8v3M10 8v4M14 8v3M18 8v4',
  offline:
    'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14 10.3A10 10 0 0 1 19 13M2 9.5a14 14 0 0 1 4.5-2.8M12 20v.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
} as const;

const Glyph: FC<{ name: keyof typeof ICONS; small?: boolean }> = ({ name, small }) => (
  <svg className={small ? 'i i-sm' : 'i'} aria-hidden="true" viewBox="0 0 24 24">
    <path d={ICONS[name]} />
  </svg>
);

const Logo: FC = () => (
  <svg aria-hidden="true" viewBox="0 0 64 64" style={{ color: 'var(--accent)' }}>
    <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M52 22 V12 H12 V52 H52 V42" />
      <path d="M23 26 V38 H35 V26" />
      <path d="M41 26 V38" />
    </g>
  </svg>
);

const PILL: Record<EnginePill, { icon: 'chip' | 'cloud' | 'ruler'; text: string }> = {
  onDevice: { icon: 'chip', text: copy.header.engine.onDevice },
  cloud: { icon: 'cloud', text: copy.header.engine.cloud },
  measured: { icon: 'ruler', text: copy.header.engine.measured },
};

const NAV = [
  { to: '/', label: copy.header.nav[0] },
  { to: '/snippet', label: copy.header.nav[1] },
  { to: '/settings', label: copy.header.nav[2] },
] as const;

/** Projects is current on `/` and everywhere under a project. */
const isCurrent = (to: string, path: string): boolean =>
  to === '/' ? path === '/' || path.startsWith('/p/') : path === to;

export interface AppHeaderProps {
  install?: InstallPrompt;
}

const never = () => false;
const noSub = () => () => undefined;

export const AppHeader: FC<AppHeaderProps> = ({ install }) => {
  const { pathname } = useLocation();
  const view = useEngineView();
  const totals = usePrivacyTotals(projectIdOf(pathname), pathname);
  const canInstall = useExternal(install?.canInstall ?? never, install?.subscribe ?? noSub);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const pill = PILL[view ? enginePill(view.status, view.mode) : 'measured'];
  const offline = view ? !view.status.online : false;
  const inProject = projectIdOf(pathname) !== undefined;

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="hdr">
        <Link className="brand" to="/" aria-label={`${copy.appName}, projects`}>
          <Logo />
          {copy.appName}
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} aria-current={isCurrent(n.to, pathname) ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hdr-status">
          {offline ? (
            <span className="offline" role="status">
              <Glyph name="offline" small />
              {copy.header.offline}
            </span>
          ) : null}
          {canInstall && install ? (
            <button className="status-link" type="button" onClick={() => void install.install()}>
              <Glyph name="download" small />
              <span className="lbl">Install app</span>
            </button>
          ) : null}
          <Link className="status-link" to="/settings#engine" aria-label={`Engine: ${pill.text}. Open engine settings`}>
            <Glyph name={pill.icon} small />
            <span className="lbl">{pill.text}</span>
          </Link>
          <PrivacyCounter
            requests={totals.requests}
            bytes={totals.bytes}
            scope={inProject ? 'project' : undefined}
            href="/settings#privacy"
          />
          <button
            className="iconbtn menu-btn"
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((o) => !o)}
          >
            <Glyph name="menu" />
          </button>
        </div>
      </header>
      <nav id={menuId} className={`mobile-nav${open ? ' open' : ''}`} aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} onClick={() => setOpen(false)}>
            {n.label}
          </Link>
        ))}
      </nav>
    </>
  );
};
