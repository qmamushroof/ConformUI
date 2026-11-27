import type { CSSProperties, FC } from 'react';

/**
 * Progress shown the moment a Run starts (SPEC-PERF-08: within 100 ms). It is not lazy: React holds back a lazy route for
 * about 300 ms after its fallback appears, so the fallback of `/p/:id/run/new` is this, not an empty page.
 */
export const RunStarting: FC = () => (
  <main id="main" tabIndex={-1} className="page" aria-busy="true">
    <section className="running" aria-label="Run progress">
      <div
        className="bar"
        role="progressbar"
        aria-label="Run progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <span style={{ '--p': '0%' } as CSSProperties} />
      </div>
      <p className="small muted">Checking requirements</p>
    </section>
  </main>
);
