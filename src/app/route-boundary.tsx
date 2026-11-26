import { CuiError } from '@kernel';
import { StateNotice } from '@projects';
import { Component, type FC, type ReactNode } from 'react';
import { Link } from 'react-router';
import { copy, stateCopy } from './copy';
import type { RouteKey } from './titles';

// SPEC-APP-03: an error boundary per route and the mapping from any thrown or rejected value to a StateNotice.
// The raw message never reaches the screen or a log (no user content in logs).

export function noticeFor(error: unknown) {
  const code = error instanceof CuiError ? error.code : 'ROUTE_ERROR';
  const base = stateCopy[code];
  // Whatever the cause, the one action of this screen is Reload.
  return { code, notice: { ...base, action: stateCopy.ROUTE_ERROR.action } };
}

export const PageNotice: FC<{ error: unknown; onReload(): void }> = ({ error, onReload }) => {
  const { code, notice } = noticeFor(error);
  return (
    <main id="main" tabIndex={-1} className="page">
      <div className="stack">
        <StateNotice notice={notice} code={code} heading onAction={onReload} />
        <p>
          <Link className="tlink small" to="/">
            {copy.routeError.back}
          </Link>
        </p>
      </div>
    </main>
  );
};

interface Props {
  route: RouteKey;
  onReload(): void;
  children: ReactNode;
}

export class RouteBoundary extends Component<Props, { error?: { value: unknown } }> {
  override state: { error?: { value: unknown } } = {};

  static getDerivedStateFromError(value: unknown) {
    return { error: { value } };
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <PageNotice error={error.value} onReload={this.props.onReload} />;
  }
}
