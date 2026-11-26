import { type FC, useEffect, useRef, useState } from 'react';
import snippetRaw from '../snippet.js?raw';
import { Icon } from './icon';

/** Code block + Copy + 3 steps + privacy line (PRD-F-13.1, SPEC §5.1 Snippet). Route `/snippet`. */
export interface SnippetPanelProps {
  /** Called after the snippet was written to the clipboard. */
  onCopy(): void;
  /** Link back to the project the user came from. */
  back?: { href: string; label: string };
}

const version = /SNIPPET_VERSION = '([^']+)'/.exec(snippetRaw)?.[1] ?? '';
const lineCount = snippetRaw.replace(/\n$/, '').split('\n').length;

export const SnippetPanel: FC<SnippetPanelProps> = ({ onCopy, back }) => {
  const pre = useRef<HTMLPreElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [note, setNote] = useState<{ ok: boolean; text: string } | undefined>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const say = (n: { ok: boolean; text: string }) => {
    setNote(n);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(undefined), n.ok ? 2600 : 8000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippetRaw);
    } catch {
      // The clipboard can be refused (no permission, insecure context): select the code so Ctrl+C works.
      const el = pre.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      say({ ok: false, text: 'Select the code and copy it: Ctrl+C (Cmd+C on Mac).' });
      return;
    }
    onCopy();
    say({ ok: true, text: 'Snippet copied' });
  };

  const project = back?.label.replace(/^Back to /, 'Open ');

  return (
    <main id="main" tabIndex={-1} className="page">
      <div className="page-head">
        <div className="stack-sm">
          {back ? (
            <a className="tlink small" href={back.href}>
              {back.label}
            </a>
          ) : null}
          <h1>DOM snippet</h1>
          <p className="muted prose">
            Run this script on your own page to copy a DOM snapshot: real element boxes, text and styles, so measured
            checks report exact pixel values and selectors.
          </p>
        </div>
      </div>

      <div className="stack-lg">
        <ol className="howto" aria-label="How to take a snapshot">
          <li>
            <h2 className="h3">Open your page at the capture width</h2>
            <p className="small muted">
              In Chrome, open the page you captured. Use 1440 px for Desktop and 390 px for Mobile; the DevTools device
              toolbar sets an exact width.
            </p>
          </li>
          <li>
            <h2 className="h3">Paste the snippet into the DevTools Console and press Enter</h2>
            <p className="small muted">
              Open the Console with Ctrl+Shift+J (Cmd+Option+J on Mac). It prints{' '}
              <span className="mono">ConformUI snapshot copied: 214 elements, 1440×1000</span>. If Chrome asks you to
              type "allow pasting", type it, then paste again.
            </p>
          </li>
          <li>
            <h2 className="h3">Come back and choose Paste snapshot</h2>
            <p className="small muted">
              In your project, under the same viewport, choose Paste snapshot.
              {back ? (
                <>
                  {' '}
                  <a href={back.href}>{project}</a>
                </>
              ) : null}
            </p>
          </li>
        </ol>

        <div className="stack">
          <div className="code">
            <div className="code-head">
              <span className="name">conformui-snippet.js</span>
              <span className="row">
                <span className="xs muted">
                  v{version} · {lineCount} lines
                </span>
                <button className="btn btn-primary" type="button" onClick={() => void copy()}>
                  <Icon name="copy" small />
                  Copy snippet
                </button>
              </span>
            </div>
            {/* biome-ignore lint/a11y/useSemanticElements: the labelled region is the code block itself, as in the prototype */}
            {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable code block must be keyboard focusable (WCAG 2.1.1) */}
            <pre ref={pre} tabIndex={0} role="region" aria-label="Snippet source code">
              <code>{snippetRaw}</code>
            </pre>
          </div>
          <p className="privacy small muted">
            <Icon name="shield" small className="ok" />
            Reads layout, text and styles only; sends nothing
          </p>
          <div className="toasts" role="status" aria-live="polite">
            {note ? (
              <div className="toast">
                <Icon name={note.ok ? 'check' : 'alert'} small />
                <span>{note.text}</span>
              </div>
            ) : null}
          </div>
        </div>

        <details className="disc">
          <summary>
            <Icon name="chev" small className="chev" />
            What the snapshot contains
            <span className="aside">Up to 1500 elements, 1 MB</span>
          </summary>
          <div className="disc-body reads">
            <div className="stack-sm">
              <h3>Reads</h3>
              <ul>
                <li>Page origin and path, title, viewport size and pixel density</li>
                <li>Landmarks, headings, links, buttons, images, form controls and text blocks</li>
                <li>Each element's box, a stable selector, its accessible name and up to 200 characters of text</li>
                <li>Computed font size and weight, colours, margins and radius</li>
                <li>Whether the page scrolls sideways, and by how much</li>
              </ul>
            </div>
            <div className="stack-sm">
              <h3>Never reads</h3>
              <ul>
                <li>Form values, checked state or hidden inputs</li>
                <li>Cookies, localStorage, sessionStorage or IndexedDB</li>
                <li>Query strings or URL fragments</li>
                <li>Anything over the network: the script makes no requests</li>
              </ul>
            </div>
          </div>
        </details>

        <div className="stack-sm">
          <div>
            <button className="btn btn-ghost" type="button" aria-disabled="true" aria-describedby="bm-why">
              <Icon name="external" small />
              Bookmarklet (coming later)
            </button>
          </div>
          <p className="small muted" id="bm-why">
            A drag-to-bookmarks version of the same script is planned. For now, use the Console.
          </p>
        </div>
      </div>
    </main>
  );
};
