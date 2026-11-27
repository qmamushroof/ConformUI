import type { EngineStatus, Settings } from '@kernel';
import type { CSSProperties, FC, ReactNode } from 'react';
import { engineTexts, percent } from '../engine-text';
import { Icon } from './icon';
import { Toasts, useToast } from './toast';

export interface EnginePanelProps {
  status: EngineStatus;
  mode: Settings['mode'];
  onDownload(): void;
  /** Plain-language message of a failed download (SPEC-SET-03). */
  error?: string;
}

const MODE_LABEL: Record<Settings['mode'], string> = {
  auto: 'Auto',
  'cloud-only': 'Cloud only',
  'on-device-only': 'On-device only',
};

const FLAG = /chrome:\/\/\S+/g;

function cloudText(s: EngineStatus): string {
  if (s.cloud === 'disabled') return 'Paused';
  return s.online ? 'Reachable' : 'Offline. Cloud steps wait for a connection; your results are kept.';
}

function imageText(s: EngineStatus): string {
  if (s.device === 'unavailable')
    return s.reason === 'image-flag-off' || s.reason === 'no-prompt-api' ? 'Off' : 'Not available';
  if (s.device === 'downloadable' || s.device === 'downloading')
    return s.deviceImage === false ? 'Off' : 'On, after download';
  if (s.deviceImage === false) return 'Off';
  if (s.deviceImage === 'unknown') return 'Not checked';
  return s.deviceImage ? 'On' : 'Off';
}

/** Engine headline, download, progress, enable steps and the cloud, image and mode rows (SPEC-SET-01..03). */
export const EnginePanel: FC<EnginePanelProps> = ({ status, mode, onDownload, error }) => {
  const [toast, notify] = useToast();
  const t = engineTexts(status);
  const pct = percent(status.downloadProgress);
  const downloading = status.device === 'downloading';
  const iconName = status.device === 'unavailable' && status.reason === 'not-desktop-chrome' ? 'cloud' : 'chip';

  const copy = async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(ok);
    } catch {
      notify('Couldn’t copy. Select the text and copy it.');
    }
  };

  const step = (text: string, i: number): ReactNode => {
    const flags = text.match(FLAG);
    if (flags) {
      return (
        <li key={text}>
          <div className="stack-sm">
            <span>
              Open {flags.length > 1 ? 'these addresses, each in a new tab' : 'this address in a new tab'}. Pages can’t
              open <span className="mono">chrome://</span> links, so copy {flags.length > 1 ? 'them' : 'it'}.
            </span>
            {flags.map((flag) => (
              <span className="inline-code small" key={flag}>
                <code>{flag}</code>
                <button
                  className="iconbtn"
                  type="button"
                  aria-label={flags.length > 1 ? `Copy flag address ${flag.split('#')[1]}` : 'Copy flag address'}
                  onClick={() => copy(flag, 'Flag address copied')}
                >
                  <Icon name="copy" small />
                </button>
              </span>
            ))}
          </div>
        </li>
      );
    }
    if (text.startsWith('Set ')) {
      return (
        <li key={text}>
          <div className="row">
            <span>
              Set {text.includes('both') ? 'both' : 'it'} to <b>Enabled</b>.
            </span>
            <button className="btn btn-link small" type="button" onClick={() => copy('Enabled', 'Copied “Enabled”')}>
              Copy
            </button>
          </div>
        </li>
      );
    }
    if (text.startsWith('Come back')) {
      return (
        <li key={text}>
          <span>
            Come back here and press <b>Download model</b>.
          </span>
        </li>
      );
    }
    return (
      <li key={`${i}-${text}`}>
        <span>{text.endsWith('.') ? text : `${text}.`}</span>
      </li>
    );
  };

  return (
    <div className="stack">
      <div className="stack-sm">
        <p className="headline">
          <Icon name={iconName} />
          <span>{downloading ? `Downloading ${pct}%` : t.headline}</span>
        </p>
        <p className="muted">{t.detail}</p>
      </div>

      {error ? (
        <div className="notice notice-danger" role="alert">
          <p className="title">{error}</p>
        </div>
      ) : null}

      {status.device === 'downloadable' ? (
        <div className="stack-sm">
          <div>
            <button className="btn btn-primary" type="button" onClick={onDownload}>
              <Icon name="download" small />
              Download model
            </button>
          </div>
          <p className="small muted">
            About 2.4 GB, downloaded once by Chrome. Nothing starts until you press the button.
          </p>
        </div>
      ) : null}

      {downloading ? (
        <div className="stack-sm">
          <div className="row-between small">
            <span>Gemini Nano 4 (Gemma 4)</span>
            <span className="muted">{pct}%</span>
          </div>
          <div
            className="bar"
            role="progressbar"
            aria-label="Model download"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span style={{ '--p': `${pct}%` } as CSSProperties} />
          </div>
          <p className="small muted">
            You can use the cloud meanwhile, with your consent. Measured and Visual checks work now.
          </p>
          {pct >= 90 && pct < 100 ? (
            <p className="small muted">
              Chrome is still finishing the download. This last part can take a few minutes.
            </p>
          ) : null}
        </div>
      ) : null}

      {t.enableSteps ? (
        <div className="stack">
          <h3>Turn on image input in Chrome</h3>
          <ol className="steps-en">{t.enableSteps.map(step)}</ol>
        </div>
      ) : null}

      <dl className="kv">
        <dt>Cloud</dt>
        <dd>{cloudText(status)}</dd>
        <dt>Image input</dt>
        <dd>{imageText(status)}</dd>
        <dt>Mode</dt>
        <dd>{MODE_LABEL[mode]}</dd>
      </dl>
      <Toasts message={toast} />
    </div>
  );
};
