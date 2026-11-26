import type { EngineStatus, Project, Settings } from '@kernel';
import { type FC, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { EngineView, SettingsService } from '../types';
import { EnginePanel } from './engine-panel';
import { Icon } from './icon';
import { privacyText } from './privacy-counter';
import { Sheet } from './sheet';
import { Toasts, useToast } from './toast';

/** Routed screen `/settings` (SPEC §4.13.2). `app` passes the services as callbacks (SPEC-ARCH-07). */
export interface SettingsScreenProps {
  settings: SettingsService;
  /** All projects, for the consent list and the privacy totals. */
  loadProjects(): Promise<Project[]>;
  /** Revokes one project's cloud consent (SPEC-SET-05). */
  onRevoke(projectId: string): Promise<void>;
  /** Called after all data was cleared, so `app` can reset state and route. */
  onCleared?(): void;
  /** What is stored, for the Data section and the clear sheet. */
  usage?: { projects: number; images: number; contracts: number; runs: number; bytes: number };
  /** Today's Deep Analysis count, named in the clear sheet. */
  deepUsage?: { count: number; cap: number };
  about?: { version: string; built?: string; licence?: string; source?: string };
  /** Latest run's engine trace, linked from Privacy. */
  trace?: { href: string; label: string };
}

const MODES: { value: Settings['mode']; label: string; help: string }[] = [
  { value: 'auto', label: 'Auto', help: 'On-device first. Cloud only for projects you allow.' },
  {
    value: 'cloud-only',
    label: 'Cloud only',
    help: 'Every AI step goes to the cloud, still only for projects you allow. Measured checks stay on this device.',
  },
  {
    value: 'on-device-only',
    label: 'On-device only',
    help: 'Never use the cloud. AI steps wait until the on-device model is ready.',
  },
];

const SECTIONS = [
  ['engine', 'Engine'],
  ['mode', 'Mode'],
  ['consent', 'Cloud consent'],
  ['privacy', 'Privacy'],
  ['data', 'Data'],
  ['about', 'About'],
] as const;

const THEME_KEY = 'cui-theme';
type Theme = 'system' | 'light' | 'dark';

function storedTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(t: Theme) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const mb = (bytes: number) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
const dateText = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const kb = (bytes: number) => String(Math.max(0.1, Math.round((bytes / 1024) * 10) / 10));

function usageText(u: NonNullable<SettingsScreenProps['usage']>, joiner: string, last: string) {
  return [
    plural(u.projects, 'project'),
    plural(u.images, 'image'),
    plural(u.contracts, 'contract'),
    plural(u.runs, 'run'),
  ].reduce((acc, p, i, all) => (i === 0 ? p : `${acc}${i === all.length - 1 ? last : joiner}${p}`), '');
}

const toStatus = (v: EngineView, progress: number | null): EngineStatus => ({
  device: progress !== null ? 'downloading' : v.device,
  deviceImage: v.imageOnDevice,
  reason: v.reason,
  downloadProgress: progress ?? v.downloadProgress,
  online: v.online,
  cloud: v.cloud,
});

interface ClearSheetProps {
  usage?: SettingsScreenProps['usage'];
  deepUsage?: SettingsScreenProps['deepUsage'];
  error: boolean;
  onCancel(): void;
  onConfirm(): void;
}

const ClearSheet: FC<ClearSheetProps> = ({ usage, deepUsage, error, onCancel, onConfirm }) => {
  const id = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const [ok, setOk] = useState(false);
  const deleted = usage
    ? `${usageText(usage, ', ', ', ')} (${mb(usage.bytes)}). Mode and the welcome screen reset.`
    : 'All projects, images, contracts and runs on this device. Mode and the welcome screen reset.';
  const kept = deepUsage
    ? `Today’s Deep Analysis count (${deepUsage.count} of ${deepUsage.cap}), so the daily limit still applies.`
    : 'Today’s Deep Analysis count, so the daily limit still applies.';
  return (
    <Sheet labelledBy={`${id}-h`} onClose={onCancel} initialFocus={cancel}>
      <div className="sheet-head">
        <div className="stack-sm">
          <h2 id={`${id}-h`}>Clear all data?</h2>
          <p className="muted small">
            This deletes all projects, images, contracts and runs on this device. It can’t be undone.
          </p>
        </div>
        <button className="iconbtn" type="button" aria-label="Close" style={{ flex: 'none' }} onClick={onCancel}>
          <Icon name="close" />
        </button>
      </div>
      <dl className="kv">
        <dt>Deleted</dt>
        <dd>{deleted}</dd>
        <dt>Kept</dt>
        <dd>{kept}</dd>
      </dl>
      {error ? (
        <div className="notice notice-danger" role="alert">
          <p className="title">Couldn’t clear the data. Nothing was deleted.</p>
        </div>
      ) : null}
      <label className="choice">
        <input type="checkbox" ref={box} checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>I understand all projects on this device are deleted</span>
      </label>
      {ok ? null : (
        <p id={`${id}-why`} className="help">
          Tick the box to turn this on.
        </p>
      )}
      <div className="sheet-foot">
        <button className="btn" type="button" ref={cancel} onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn-danger"
          type="button"
          aria-disabled={ok ? undefined : 'true'}
          aria-describedby={ok ? undefined : `${id}-why`}
          onClick={() => (ok ? onConfirm() : box.current?.focus())}
        >
          <Icon name="trash" small />
          Clear all data
        </button>
      </div>
    </Sheet>
  );
};

export const SettingsScreen: FC<SettingsScreenProps> = ({
  settings,
  loadProjects,
  onRevoke,
  onCleared,
  usage,
  deepUsage,
  about,
  trace,
}) => {
  const [view, setView] = useState<EngineView | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dlError, setDlError] = useState<string | undefined>();
  const [everSent, setEverSent] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [mode, setMode] = useState<Settings['mode']>('auto');
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState(false);
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const [toast, notify] = useToast();
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const focusNext = useRef(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const [v, s, p] = await Promise.all([settings.engine(), settings.read(), loadProjects()]);
      if (!live) return;
      setView(v);
      setMode(s.mode);
      setEverSent(s.everSentToCloud);
      setProjects(p);
    })().catch(() => {});
    return () => {
      live = false;
    };
  }, [settings, loadProjects]);

  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    const first = listRef.current?.querySelector<HTMLElement>('button');
    (first ?? emptyRef.current)?.focus();
  });

  const consented = projects.filter((p) => p.cloudConsent);
  const sentRequests = projects.reduce((n, p) => n + p.cloudUsage.requests, 0);
  const sentBytes = projects.reduce((n, p) => n + p.cloudUsage.bytes, 0);
  const sent = everSent || sentRequests > 0;
  const privText =
    sentRequests > 0
      ? privacyText(sentRequests, sentBytes)
      : sent
        ? 'Cloud was used. Open a project to see its totals.'
        : 'Nothing has left this device';

  const download = useCallback(async () => {
    setDlError(undefined);
    setProgress(0);
    try {
      setView(await settings.downloadModel((p) => setProgress(p)));
      notify('On-device model ready');
    } catch {
      setDlError('Couldn’t download the model. Check your connection and try again.');
    } finally {
      setProgress(null);
    }
  }, [settings, notify]);

  const changeMode = async (m: Settings['mode'], label: string) => {
    const before = mode;
    setMode(m);
    try {
      await settings.setMode(m);
      notify(`Mode: ${label}. Applies to the next request.`);
    } catch {
      setMode(before);
      notify('Couldn’t save the mode. Nothing changed.');
    }
  };

  const revoke = async (p: Project) => {
    try {
      await onRevoke(p.id);
      focusNext.current = true;
      setProjects((all) => all.map((x) => (x.id === p.id ? { ...x, cloudConsent: undefined } : x)));
      notify(`Revoked cloud for ${p.name}`);
    } catch {
      notify(`Couldn’t revoke cloud for ${p.name}. Nothing changed.`);
    }
  };

  const clearAll = async () => {
    try {
      await settings.clearAllData();
    } catch {
      setClearError(true);
      return;
    }
    setClearing(false);
    setClearError(false);
    setProjects([]);
    setEverSent(false);
    setMode('auto');
    notify('All data cleared. Deep Analysis count kept.');
    onCleared?.();
  };

  const notOnDevice = view?.device === 'unavailable' && view.reason === 'not-desktop-chrome';
  const helpId = useId();
  const dataLine = usage
    ? `${usageText(usage, ', ', ' and ')} use ${mb(usage.bytes)} on this device.`
    : `${plural(projects.length, 'project')} on this device.`;

  return (
    <main id="main" tabIndex={-1} className="page">
      <div className="page-head">
        <div className="stack-sm">
          <h1>Settings</h1>
          <p className="muted">Engine, cloud use and data on this device.</p>
        </div>
      </div>

      <div className="set-grid">
        <nav className="set-nav" aria-label="Settings sections">
          <ul>
            {SECTIONS.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`} aria-current={i === 0 ? 'true' : undefined}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <section className="set-sec" id="engine" aria-labelledby="engine-h">
            <h2 id="engine-h">Engine</h2>
            {view ? (
              <EnginePanel status={toStatus(view, progress)} mode={mode} onDownload={download} error={dlError} />
            ) : null}
          </section>

          <section className="set-sec" id="mode" aria-labelledby="mode-h">
            <h2 id="mode-h">Mode</h2>
            <fieldset>
              <legend className="sr-only">AI mode</legend>
              {MODES.map((m) => {
                const off = m.value === 'on-device-only' && notOnDevice;
                return (
                  <label className="choice" key={m.value}>
                    <input
                      type="radio"
                      name="mode"
                      value={m.value}
                      checked={mode === m.value}
                      disabled={off}
                      aria-describedby={m.value === 'on-device-only' ? helpId : undefined}
                      onChange={() => changeMode(m.value, m.label)}
                    />
                    <span>{m.label}</span>
                    <span className="help" id={m.value === 'on-device-only' ? helpId : undefined}>
                      {off ? 'Not available: this browser has no on-device model.' : m.help}
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <p className="small muted">A change applies to the next request.</p>
          </section>

          <section className="set-sec" id="consent" aria-labelledby="consent-h">
            <h2 id="consent-h">Cloud consent</h2>
            <p className="muted">
              Projects allowed to send data to Google Gemini through Firebase. Revoking takes effect now; the next cloud
              request asks again.
            </p>
            {consented.length > 0 ? (
              <ul className="consent-list" ref={listRef} aria-label="Projects allowed to use the cloud">
                {consented.map((p) => (
                  <li key={p.id}>
                    <div>
                      <div>{p.name}</div>
                      <div className="small muted">
                        Allowed {dateText(p.cloudConsent?.grantedAt ?? 0)} ·{' '}
                        {p.cloudUsage.requests === 0
                          ? 'no requests yet'
                          : `${plural(p.cloudUsage.requests, 'request')} so far`}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      aria-label={`Revoke cloud for ${p.name}`}
                      onClick={() => revoke(p)}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" tabIndex={-1} ref={emptyRef}>
                No project can use the cloud. Each project asks before its first cloud request.
              </p>
            )}
          </section>

          <section className="set-sec" id="privacy" aria-labelledby="privacy-h">
            <h2 id="privacy-h">Privacy</h2>
            <p className="headline">
              <span className={`dot${sent ? ' off' : ''}`} style={{ marginTop: 'var(--space-2)' }} aria-hidden="true" />
              <span id="priv-text">{privText}</span>
            </p>
            <p className="muted">
              {sent
                ? `Cloud steps sent ${kb(sentBytes)} KB. Every other step ran on this device.`
                : 'Designs, captures, snapshots, contracts and runs are stored only in this browser. Measured checks never leave it.'}
            </p>
            {trace ? (
              <p className="small">
                <a href={trace.href}>{trace.label}</a>
              </p>
            ) : null}
          </section>

          <section className="set-sec" id="data" aria-labelledby="data-h">
            <h2 id="data-h">Data</h2>
            <p className="muted">{dataLine}</p>
            <div>
              <button
                className="btn btn-danger-outline"
                type="button"
                onClick={() => {
                  setClearError(false);
                  setClearing(true);
                }}
              >
                <Icon name="trash" small />
                Clear all data
              </button>
            </div>
          </section>

          <section className="set-sec" id="about" aria-labelledby="about-h">
            <h2 id="about-h">About</h2>
            <dl className="kv">
              <dt>Version</dt>
              <dd>{about ? `${about.version}${about.built ? `, built ${about.built}` : ''}` : '0.1.0'}</dd>
              <dt>Licence</dt>
              <dd>{about?.licence ?? 'Apache-2.0'}</dd>
              <dt>Source</dt>
              <dd className={about?.source ? undefined : 'muted'}>
                {about?.source ? <a href={about.source}>{about.source}</a> : 'Repository link added at release'}
              </dd>
            </dl>
            <div className="field" style={{ maxWidth: 280 }}>
              <label htmlFor="theme">Theme</label>
              <select
                className="select"
                id="theme"
                value={theme}
                onChange={(e) => {
                  const t = e.target.value as Theme;
                  setTheme(t);
                  applyTheme(t);
                  try {
                    localStorage.setItem(THEME_KEY, t);
                  } catch {
                    // storage can be blocked; the choice then lasts for this visit only
                  }
                }}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </section>
        </div>
      </div>

      {clearing ? (
        <ClearSheet
          usage={usage}
          deepUsage={deepUsage}
          error={clearError}
          onCancel={() => setClearing(false)}
          onConfirm={clearAll}
        />
      ) : null}
      <Toasts message={toast} />
    </main>
  );
};
