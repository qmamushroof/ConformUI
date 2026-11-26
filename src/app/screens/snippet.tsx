import { SnippetPanel, snippetSource } from '@snippet';
import type { FC } from 'react';
import { routeName } from '../titles';

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard blocked: select-and-copy from the code block still works.
  }
}

/** `/snippet` (SPEC-SNIP-*): page frame around the lane C `SnippetPanel`. */
const SnippetRoute: FC = () => (
  <main id="main" tabIndex={-1} className="page">
    <div className="page-head">
      <div className="stack-sm">
        <h1>{routeName('snippet')}</h1>
      </div>
    </div>
    <SnippetPanel onCopy={() => void copyText(snippetSource)} />
  </main>
);
export default SnippetRoute;
