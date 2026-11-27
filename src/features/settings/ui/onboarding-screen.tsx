import { type CSSProperties, type FC, useEffect, useState } from 'react';
import type { EngineView, SettingsService } from '../types';
import { EngineBadge } from './engine-badge';
import { Icon } from './icon';

/** Privacy statement rows, from `app/copy.ts` (SPEC-SET-08). */
export interface PrivacyCopy {
  stored: string;
  sent: string;
  domSnippet: string;
  appCheck: string;
  analytics: string;
}

/** Routed screen `/welcome` (SPEC-SET-08). */
export interface OnboardingScreenProps {
  settings: SettingsService;
  privacy: PrivacyCopy;
  onTrySample(): void;
  onStartProject(): void;
  /** Requirements in the sample's contract, read from it by the app; the count is left out until known. */
  sampleRequirements?: number;
}

const LOOP = [
  ['Contract', 'Requirements read from your design. You review them, add your own, and lock the list.'],
  ['Run', 'Screenshots and a DOM snapshot of your page, checked against every requirement with measured numbers.'],
  ['Fix prompt', 'The failures as one paste-ready prompt: selector, design value, actual value and what to change.'],
  ['Re-verify', 'New captures after the fix show what is resolved, what remains and what regressed.'],
] as const;

type Download = 'idle' | 'busy' | 'done';

export const OnboardingScreen: FC<OnboardingScreenProps> = ({
  settings,
  privacy,
  onTrySample,
  onStartProject,
  sampleRequirements,
}) => {
  const [view, setView] = useState<EngineView | null>(null);
  const [dl, setDl] = useState<Download>('idle');
  const [pct, setPct] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    settings
      .engine()
      .then((v) => live && setView(v))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [settings]);

  const leave = async (go: () => void) => {
    try {
      await settings.markOnboarded();
    } catch {
      // the welcome screen may show again next time; the user still moves on
    }
    go();
  };

  const download = async () => {
    if (dl !== 'idle') return;
    setError(false);
    setDl('busy');
    setPct(0);
    try {
      setView(await settings.downloadModel((p) => setPct(Math.round(Math.min(1, Math.max(0, p)) * 100))));
      setDl('done');
    } catch {
      setError(true);
      setDl('idle');
    }
  };

  const showOffer = view?.canDownload || dl !== 'idle';
  const label =
    dl === 'busy'
      ? `Downloading ${pct}%`
      : dl === 'done'
        ? 'Downloaded'
        : 'Download on-device model (about 2 GB, once)';

  return (
    <main id="main" tabIndex={-1} className="page">
      <div className="ob stack-lg">
        <div className="stack">
          <p className="small muted">First run</p>
          <h1>Check a page against its design</h1>
          <p className="lead prose">
            ConformUI turns your design into a contract of checkable requirements, measures your page against it, and
            writes the failures as a prompt for your coding agent.
          </p>
          <div className="btn-row" style={{ marginTop: 'var(--space-2)' }}>
            <button className="btn btn-primary" type="button" onClick={() => leave(onTrySample)}>
              <Icon name="play" small />
              Try the sample
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => leave(onStartProject)}>
              Start a project
            </button>
          </div>
          <p className="small muted">
            The sample is a landing page with Desktop and Mobile captures and a{' '}
            {sampleRequirements === undefined ? '' : `${sampleRequirements}-requirement `}contract, ready to run.
          </p>
        </div>

        {showOffer ? (
          <div className="prose">
            <div className="notice notice-info">
              <Icon name="chip" />
              <p className="title">
                {dl === 'done'
                  ? 'On-device model ready. The first pass stays on this device.'
                  : "This browser can run Gemma 4, but the model isn't downloaded yet."}
              </p>
              <p className="small muted">
                {dl === 'done'
                  ? 'Contract extraction and judged checks now run here first.'
                  : 'With it, contract extraction stays on this device. Without it, ConformUI asks before using the cloud, or you write requirements yourself.'}
              </p>
              {dl === 'busy' ? (
                <div
                  className="bar"
                  role="progressbar"
                  aria-label="On-device model download"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                >
                  <span style={{ '--p': `${pct}%` } as CSSProperties} />
                </div>
              ) : null}
              {error ? (
                <p className="small" role="alert">
                  Couldn’t download the model. Check your connection and try again.
                </p>
              ) : null}
              <div className="btn-row">
                <button
                  className="btn"
                  type="button"
                  id="dl-btn"
                  aria-busy={dl === 'busy' ? 'true' : undefined}
                  aria-disabled={dl === 'done' ? 'true' : undefined}
                  onClick={download}
                >
                  {dl === 'busy' || dl === 'done' ? null : <Icon name="download" small />}
                  {label}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section className="ob-sec" aria-labelledby="loop-h">
          <h2 id="loop-h">The loop</h2>
          <ol className="loop" aria-labelledby="loop-h">
            {LOOP.map(([title, text], i) => (
              <li key={title}>
                <div className="hd">
                  <span className="n" aria-hidden="true">
                    {i + 1}.
                  </span>
                  {title}
                </div>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="ob-sec" aria-labelledby="eng-h">
          <h2 id="eng-h">Three engines, always named</h2>
          <p className="small muted prose">Every requirement, finding and trace row says which engine produced it.</p>
          <dl className="engines">
            <dt>
              <EngineBadge engine="on-device" />
            </dt>
            <dd>Gemma 4 in Chrome. First pass stays on this device.</dd>
            <dt>
              <EngineBadge engine="cloud" />
            </dt>
            <dd>Gemini through Firebase. Only when you allow it, per project, or for Deep Analysis.</dd>
            <dt>
              <EngineBadge engine="measured" />
            </dt>
            <dd>Deterministic engine. Every number comes from here, never from a model.</dd>
          </dl>
        </section>

        <section className="ob-sec" aria-labelledby="priv-h">
          <h2 id="priv-h">What stays and what is sent</h2>
          <div className="table-wrap">
            <table className="data privacy">
              <caption className="sr-only">Privacy statement</caption>
              <thead>
                <tr>
                  <th scope="col">Topic</th>
                  <th scope="col">What happens</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Stored', privacy.stored],
                    ['Sent', privacy.sent],
                    ['DOM snippet', privacy.domSnippet],
                    ['App Check', privacy.appCheck],
                    ['Analytics', privacy.analytics],
                  ] as const
                ).map(([topic, text]) => (
                  <tr key={topic}>
                    <th scope="row">{topic}</th>
                    <td>{text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            Change any of this later in <a href="/settings">Settings</a>. Get the DOM snippet from{' '}
            <a href="/snippet">Snippet</a>.
          </p>
        </section>
      </div>
    </main>
  );
};
