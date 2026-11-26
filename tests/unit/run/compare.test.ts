import type { Change, Run } from '@kernel';
import { describe, expect, it } from 'vitest';
import { compareRuns, createRunService } from '../../../src/features/run';
import { requirementResult, run as sampleRun } from '../../helpers/samples';
import { cta, status, world } from './harness';

// SPEC-RUN-09..11, PRD-F-07.1..07.3, PRD-M-02.

type S = 'pass' | 'fail' | 'needs-review' | 'not-checked';
const mk = (id: string, s: S | undefined, viewport: 'desktop' | 'mobile' = 'desktop') =>
  s === undefined ? [] : [requirementResult({ requirementId: id, viewport, status: s, finding: undefined })];
const runOf = (...rs: ReturnType<typeof mk>[]): Run => sampleRun({ results: rs.flat(), changes: undefined });

const change = (prev: S | undefined, next: S | undefined): Change | undefined =>
  compareRuns(runOf(mk('R-01', prev)), runOf(mk('R-01', next)))['R-01:desktop'];

describe('compareRuns (SPEC-RUN-10, PRD-F-07.2)', () => {
  it('SPEC-RUN-10: failing then pass is resolved, for fail and for needs-review', () => {
    expect(change('fail', 'pass')).toBe('resolved');
    expect(change('needs-review', 'pass')).toBe('resolved');
  });

  it('SPEC-RUN-10: failing then failing is remaining, whichever kind of failing', () => {
    expect(change('fail', 'fail')).toBe('remaining');
    expect(change('fail', 'needs-review')).toBe('remaining');
    expect(change('needs-review', 'fail')).toBe('remaining');
    expect(change('needs-review', 'needs-review')).toBe('remaining');
  });

  it('SPEC-RUN-10: pass then failing is regressed', () => {
    expect(change('pass', 'fail')).toBe('regressed');
    expect(change('pass', 'needs-review')).toBe('regressed');
  });

  it('SPEC-RUN-10: absent or not-checked then failing is new', () => {
    expect(change(undefined, 'fail')).toBe('new');
    expect(change('not-checked', 'fail')).toBe('new');
    expect(change('not-checked', 'needs-review')).toBe('new');
  });

  it('SPEC-RUN-10: pass then pass is still-passing', () => {
    expect(change('pass', 'pass')).toBe('still-passing');
  });

  it('SPEC-RUN-10: a result that is now not-checked has no change label', () => {
    for (const prev of ['pass', 'fail', 'needs-review', 'not-checked', undefined] as const) {
      expect(change(prev, 'not-checked'), String(prev)).toBeUndefined();
    }
  });

  it('SPEC-RUN-10: a pass that was absent or not-checked has no label either', () => {
    expect(change(undefined, 'pass')).toBeUndefined();
    expect(change('not-checked', 'pass')).toBeUndefined();
  });

  it('SPEC-RUN-10: the key is reqId:viewport, so the same id on two viewports compares separately', () => {
    const prev = runOf(mk('R-01', 'fail'), mk('R-01', 'pass', 'mobile'));
    const next = runOf(mk('R-01', 'pass'), mk('R-01', 'fail', 'mobile'));
    expect(compareRuns(prev, next)).toEqual({ 'R-01:desktop': 'resolved', 'R-01:mobile': 'regressed' });
  });

  it('SPEC-RUN-10: comparing a Run with itself resolves nothing and regresses nothing', () => {
    const r = runOf(mk('R-01', 'fail'), mk('R-02', 'pass'), mk('R-03', 'needs-review'));
    expect(compareRuns(r, r)).toEqual({
      'R-01:desktop': 'remaining',
      'R-02:desktop': 'still-passing',
      'R-03:desktop': 'remaining',
    });
  });
});

describe('summary (SPEC-RUN-10, PRD-F-07.2)', () => {
  const svc = createRunService({} as never);

  it('SPEC-RUN-10: the line lists non-zero counts in the order resolved, remaining, new, regressed', () => {
    const r = sampleRun({
      results: [...mk('A', 'pass'), ...mk('B', 'fail'), ...mk('C', 'needs-review'), ...mk('D', 'not-checked')],
      changes: {
        'A:desktop': 'resolved',
        'B:desktop': 'remaining',
        'C:desktop': 'regressed',
        'E:desktop': 'new',
        'F:desktop': 'resolved',
      },
    });
    const s = svc.summary(r);
    expect(s.line).toBe('2 resolved, 1 remaining, 1 new, 1 regressed');
    expect(s).toMatchObject({ pass: 1, fail: 1, review: 1, notChecked: 1 });
    expect(s.changes).toEqual({ resolved: 2, remaining: 1, new: 1, regressed: 1, 'still-passing': 0 });
  });

  it('SPEC-RUN-10: "6 resolved, 1 remaining" omits zero counts and still-passing', () => {
    const changes: Record<string, Change> = { x: 'still-passing' };
    for (let i = 0; i < 6; i++) changes[`r${i}:desktop`] = 'resolved';
    changes['rem:desktop'] = 'remaining';
    expect(svc.summary(sampleRun({ results: [], changes })).line).toBe('6 resolved, 1 remaining');
  });

  it('SPEC-RUN-10: with a baseline but no changes the line says so', () => {
    expect(svc.summary(sampleRun({ results: [], changes: { 'a:desktop': 'still-passing' } })).line).toBe(
      'No changes since the last Run',
    );
    expect(svc.summary(sampleRun({ results: [], changes: {} })).line).toBe('No changes since the last Run');
  });

  it('SPEC-RUN-10: without a baseline there are no changes and the line gives the counts', () => {
    const s = svc.summary(
      sampleRun({ results: [...mk('A', 'fail'), ...mk('B', 'pass'), ...mk('C', 'pass')], changes: undefined }),
    );
    expect(s.changes).toBeUndefined();
    expect(s.line).toBe('1 failed, 2 passed');
    expect(svc.summary(sampleRun({ results: [], changes: undefined })).line).toBe('Nothing checked');
  });
});

describe('Re-verify and history (SPEC-RUN-09, SPEC-RUN-11, PRD-F-07.1, PRD-F-07.3)', () => {
  it('SPEC-RUN-09, PRD-F-07.1: a second start with the same Contract compares with the newest earlier Run of that Contract', async () => {
    const w = await world();
    const first = await w.service.start('project-1', w.ctxFor(), w.on);
    expect(first.baselineRunId).toBeUndefined();
    expect(first.changes).toBeUndefined();

    w.clock.advance(1000);
    const project = await w.store.get('project-1');
    if (!project) throw new Error('seed');
    const fixedCapture = { ...(project.captures[0] as NonNullable<(typeof project.captures)[0]>), dom: cta(100) };
    await w.store.put({ ...project, captures: [fixedCapture] });
    const second = await w.service.start('project-1', w.ctxFor(), w.on);
    expect(second.baselineRunId).toBe(first.id);
    expect(second.changes?.['R-01:desktop']).toBe('resolved');
    expect(w.service.summary(second).line).toMatch(/1 resolved/);

    w.clock.advance(1000);
    const third = await w.service.start('project-1', w.ctxFor(), w.on);
    expect(third.baselineRunId).toBe(second.id);
    expect(third.changes?.['R-01:desktop']).toBe('still-passing');
  });

  it('SPEC-RUN-09: Runs of another Contract version are not used as the baseline', async () => {
    const w = await world();
    const first = await w.service.start('project-1', w.ctxFor(), w.on);
    const contract = await w.store.getContract('contract-1');
    const project = await w.store.get('project-1');
    if (!contract || !project) throw new Error('seed');
    await w.store.putContract({ ...contract, id: 'contract-2', version: 2, locked: false });
    await w.store.put({ ...project, activeContractId: 'contract-2' });
    w.clock.advance(1000);
    const second = await w.service.start('project-1', w.ctxFor(), w.on);
    expect(second.baselineRunId).toBeUndefined();
    expect(second.contractId).toBe('contract-2');
    expect(first.contractId).toBe('contract-1');
  });

  it('SPEC-RUN-11, PRD-F-07.3: history lists newest first with date, contract version, viewports and counts', async () => {
    const w = await world({
      captures: [
        { viewport: 'desktop', dom: cta(132) },
        { viewport: 'mobile', dom: cta(100) },
      ],
    });
    const a = await w.service.start('project-1', w.ctxFor(), w.on);
    w.clock.advance(5000);
    const b = await w.service.start('project-1', w.ctxFor({ status: status() }), w.on);
    const h = await w.service.history('project-1');
    expect(h.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(h[0]).toMatchObject({ createdAt: b.createdAt, contractVersion: 1, viewports: ['desktop', 'mobile'] });
    const counts = w.service.summary(b);
    expect(h[0]).toMatchObject({ pass: counts.pass, fail: counts.fail, review: counts.review });
  });

  it('SPEC-RUN-11: history of a Project with no Runs is empty and does not mix Projects', async () => {
    const w = await world();
    expect(await w.service.history('project-1')).toEqual([]);
    await w.service.start('project-1', w.ctxFor(), w.on);
    expect(await w.service.history('other')).toEqual([]);
    expect(await w.service.get('missing')).toBeUndefined();
  });
});
