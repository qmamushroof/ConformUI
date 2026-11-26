import { SnippetPanel } from '@snippet';
import type { FC } from 'react';

/** `/snippet` (SPEC-SNIP-*): the panel copies the snippet itself; nothing for `app` to do afterwards. */
const SnippetRoute: FC = () => <SnippetPanel onCopy={() => undefined} />;
export default SnippetRoute;
