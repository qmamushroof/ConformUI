import { StateNotice } from '@projects';
import { type FC, useEffect, useState } from 'react';
import { type Composed, compose } from './compose';
import { stateCopy } from './copy';
import type { AppEnv } from './env';
import { installPrompt, updateFlow } from './pwa-register';
import { AppRoutes } from './routes';
import { ServicesProvider } from './services';

// SPEC-APP-01, SPEC-APP-03: compose, then render. A storage rejection shows the full-screen notice and composes nothing.

type State = { kind: 'loading' } | { kind: 'ready'; composed: Composed } | { kind: 'storage-failed' };

export interface BootProps {
  env: AppEnv;
  /** Production with an invalid environment (SPEC-APP-06). */
  configError?: boolean;
}

/** After first paint, so Firebase never competes with the initial load (SPEC-PERF-04). */
const afterPaint = (fn: () => void) => {
  if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 0);
};

export const Boot: FC<BootProps> = ({ env, configError }) => {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    compose(env)
      .then((composed) => {
        if (!live) return;
        setState({ kind: 'ready', composed });
        requestAnimationFrame(() => afterPaint(() => void composed.startEngine()));
      })
      .catch(() => {
        // Only storage can reject compose, and every such failure is STORAGE_UNAVAILABLE (SPEC-APP-03).
        if (live) setState({ kind: 'storage-failed' });
      });
    return () => {
      live = false;
    };
  }, [env]);

  if (state.kind === 'loading') return <main id="main" tabIndex={-1} className="page" aria-busy="true" />;
  if (state.kind === 'storage-failed') {
    return (
      <main id="main" tabIndex={-1} className="page">
        <StateNotice
          notice={stateCopy.STORAGE_UNAVAILABLE}
          code="STORAGE_UNAVAILABLE"
          heading
          onAction={() => window.location.reload()}
        />
      </main>
    );
  }
  return (
    <ServicesProvider services={state.composed.services}>
      <AppRoutes appVersion={env.appVersion} install={installPrompt} update={updateFlow} configError={configError} />
    </ServicesProvider>
  );
};
