import type { Change, Run, RunSummary, ViewportId } from '@kernel';

// Re-verify comparison, summary line and history (SPEC-RUN-09..11, PRD-F-07).

const failing = (s: string | undefined) => s === 'fail' || s === 'needs-review';

/**
 * SPEC-RUN-10, per `reqId:viewport` (failing = fail or needs-review): failing then pass = resolved; failing then
 * failing = remaining; pass then failing = regressed; absent or not-checked then failing = new; pass then pass =
 * still-passing. A result that is now not-checked has no label, nor has a pass that was absent or not-checked.
 */
export function compareRuns(prev: Run, next: Run): Record<string, Change> {
  const before = new Map(prev.results.map((r) => [`${r.requirementId}:${r.viewport}`, r.status]));
  const out: Record<string, Change> = {};
  for (const r of next.results) {
    const key = `${r.requirementId}:${r.viewport}`;
    const was = before.get(key);
    if (r.status === 'pass') {
      if (failing(was)) out[key] = 'resolved';
      else if (was === 'pass') out[key] = 'still-passing';
    } else if (failing(r.status)) {
      if (failing(was)) out[key] = 'remaining';
      else if (was === 'pass') out[key] = 'regressed';
      else out[key] = 'new';
    }
  }
  return out;
}

const LINE_ORDER: Change[] = ['resolved', 'remaining', 'new', 'regressed'];

export function summarise(run: Run): {
  pass: number;
  fail: number;
  review: number;
  notChecked: number;
  changes?: Record<Change, number>;
  line: string;
} {
  const count = (s: string) => run.results.filter((r) => r.status === s).length;
  const pass = count('pass');
  const fail = count('fail');
  const review = count('needs-review');
  const notChecked = count('not-checked');
  if (!run.changes) {
    const parts = [
      fail > 0 && `${fail} failed`,
      review > 0 && `${review} to review`,
      pass > 0 && `${pass} passed`,
    ].filter((p): p is string => p !== false);
    return { pass, fail, review, notChecked, line: parts.length > 0 ? parts.join(', ') : 'Nothing checked' };
  }
  const changes: Record<Change, number> = { resolved: 0, remaining: 0, new: 0, regressed: 0, 'still-passing': 0 };
  for (const c of Object.values(run.changes)) changes[c]++;
  const parts = LINE_ORDER.filter((c) => changes[c] > 0).map((c) => `${changes[c]} ${c}`);
  return {
    pass,
    fail,
    review,
    notChecked,
    changes,
    line: parts.length > 0 ? parts.join(', ') : 'No changes since the last Run',
  };
}

const VIEWPORT_ORDER: ViewportId[] = ['desktop', 'mobile', 'tablet'];

/** SPEC-RUN-11 row: date, contract version, viewports, counts. */
export function runSummary(run: Run, contractVersion: number): RunSummary {
  const s = summarise(run);
  const seen = new Set(run.results.filter((r) => r.reason !== 'no-capture').map((r) => r.viewport));
  return {
    id: run.id,
    createdAt: run.createdAt,
    contractVersion,
    viewports: VIEWPORT_ORDER.filter((v) => seen.has(v)),
    pass: s.pass,
    fail: s.fail,
    review: s.review,
  };
}
