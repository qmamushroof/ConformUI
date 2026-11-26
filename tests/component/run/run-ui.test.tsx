import type { Finding, Requirement, Run, RunSummary, TraceStep } from '@kernel';
import {
  ComparisonView,
  EngineTrace,
  FindingDetail,
  FindingList,
  RunHistory,
  RunProgress,
  RunScreen,
  type RunScreenProps,
} from '@run';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const finding = (id: string, o: Partial<Finding> = {}): Finding => ({
  id: `run_1:${id}:desktop`,
  requirementId: id,
  viewport: 'desktop',
  label: 'explicit',
  status: 'fail',
  severity: 'major',
  confidence: 'high',
  engine: 'measured',
  statement: `Statement of ${id}`,
  suggestedFix: `Fix for ${id}`,
  condition: `Condition of ${id}`,
  origin: 'rule',
  evidence: {
    designCrop: { x: 64, y: 400, w: 220, h: 56 },
    captureCrop: { x: 64, y: 400, w: 132, h: 56 },
    diffRatio: 0.4,
    selector: 'main .hero a.btn-primary',
    measurements: [
      {
        name: 'Width',
        design: 220,
        observed: 132,
        unit: 'px',
        delta: -88,
        deltaPct: -40,
        source: { design: 'design-image', observed: 'dom-snapshot' },
      },
    ],
  },
  ...o,
});

const req = (id: string, o: Partial<Requirement> = {}): Requirement => ({
  id,
  viewport: 'desktop',
  category: 'size',
  label: 'explicit',
  checkType: 'measured',
  statement: `Requirement ${id}`,
  condition: `Condition ${id}`,
  check: { kind: 'presence', match: { text: id } },
  accepted: true,
  origin: 'ai',
  ...o,
});

const trace = (step: string, o: Partial<TraceStep> = {}): TraceStep => ({
  step,
  engine: 'measured',
  durationMs: 120,
  bytesSent: 0,
  ...o,
});

const img = (w = 1440, h = 1000) => ({ src: 'blob:x', width: w, height: h });

const THRESH = {} as Run['thresholds'];
const run = (o: Partial<Run> = {}): Run => ({
  id: 'run_7f3a91d2c21e',
  projectId: 'p1',
  contractId: 'c1',
  createdAt: Date.UTC(2026, 10, 25, 14, 32),
  captureIds: ['cap1'],
  thresholds: THRESH,
  results: [],
  trace: [],
  precomputed: false,
  ...o,
});
const summary = (o: Partial<RunScreenProps['summary']> = {}): RunScreenProps['summary'] => ({
  pass: 1,
  fail: 2,
  review: 1,
  notChecked: 1,
  line: '2 failed, 1 to review, 1 passed',
  ...o,
});

const F1 = finding('R-D-06', { severity: 'critical' });
const F2 = finding('R-D-04');
const F3 = finding('R-D-05', { status: 'needs-review', severity: 'minor', confidence: 'low', engine: 'on-device' });
const F4 = finding('I-M-01', { viewport: 'mobile', label: 'inferred', severity: 'minor' });

const reqs = [
  req('R-D-01'),
  req('R-D-06'),
  req('R-D-04'),
  req('R-D-05'),
  req('R-D-11'),
  req('I-M-01', { viewport: 'mobile' }),
];

const res = (
  id: string,
  status: Run['results'][number]['status'],
  o: Partial<Run['results'][number]> = {},
): Run['results'][number] => ({
  requirementId: id,
  viewport: 'desktop',
  status,
  engine: 'measured',
  confidence: 'high',
  ...o,
});

const baseRun = () =>
  run({
    results: [
      res('R-D-01', 'pass'),
      res('R-D-06', 'fail', { finding: F1 }),
      res('R-D-04', 'fail', { finding: F2 }),
      res('R-D-05', 'needs-review', { engine: 'on-device', confidence: 'low', finding: F3 }),
      res('I-M-01', 'fail', { viewport: 'mobile', finding: F4 }),
      res('R-D-11', 'not-checked', { reason: 'outside-capture' }),
    ],
    trace: [trace('measured desktop'), trace('judge R-D-05 desktop', { engine: 'on-device', durationMs: 4200 })],
  });

function mount(o: Partial<RunScreenProps> = {}) {
  const props: RunScreenProps = {
    project: { id: 'p1', name: 'Sample landing page' },
    run: baseRun(),
    runNumber: 1,
    findings: [F1, F2, F3, F4],
    summary: summary({ fail: 3 }),
    requirements: reqs,
    contract: { version: 1, locked: true },
    onReverify: vi.fn(),
    onCopyFixPrompt: vi.fn(),
    onCopyText: vi.fn(),
    onExport: vi.fn(),
    ...o,
  };
  return { props, ...render(<RunScreen {...props} />) };
}

describe('SPEC-UI-01, SPEC-UI-04: FindingList', () => {
  it('SPEC-RUN-08: lists findings in the given order as a listbox with options and aria-selected', () => {
    const onSelect = vi.fn();
    render(<FindingList findings={[F1, F2, F3]} selectedId={F2.id} onSelect={onSelect} />);
    const list = screen.getByRole('listbox', { name: 'Findings, sorted by severity' });
    const opts = within(list).getAllByRole('option');
    expect(opts.length).toBe(3);
    expect(opts[0]?.textContent).toContain('Statement of R-D-06');
    expect(opts[1]?.getAttribute('aria-selected')).toBe('true');
    expect(list.getAttribute('aria-activedescendant')).toBe(opts[1]?.id);
  });

  it('SPEC-UI-04: status and severity are icon plus text, never colour only', () => {
    render(<FindingList findings={[F1, F3, F4]} onSelect={vi.fn()} />);
    const [crit, review, inferred] = screen.getAllByRole('option');
    expect(crit?.textContent).toContain('Critical');
    expect(crit?.querySelector('svg')).toBeTruthy();
    expect(review?.textContent).toContain('Needs review');
    expect(review?.textContent).toContain('On-device');
    expect(inferred?.textContent).toContain('Inferred');
    expect(inferred?.textContent).toContain('Mobile');
  });

  it('SPEC-UI-06: Down/Up/Home/End move selection, Enter activates', () => {
    const onSelect = vi.fn();
    const onActivate = vi.fn();
    render(<FindingList findings={[F1, F2, F3]} selectedId={F2.id} onSelect={onSelect} onActivate={onActivate} />);
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenLastCalledWith(F3.id);
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenLastCalledWith(F1.id);
    fireEvent.keyDown(list, { key: 'End' });
    expect(onSelect).toHaveBeenLastCalledWith(F3.id);
    fireEvent.keyDown(list, { key: 'Home' });
    expect(onSelect).toHaveBeenLastCalledWith(F1.id);
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onActivate).toHaveBeenLastCalledWith(F2.id);
  });

  it('SPEC-UI-06: ArrowDown on the last row stays put', () => {
    const onSelect = vi.fn();
    render(<FindingList findings={[F1, F2]} selectedId={F2.id} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('SPEC-UI-06: with nothing selected ArrowDown selects the first finding', () => {
    const onSelect = vi.fn();
    render(<FindingList findings={[F1, F2]} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith(F1.id);
  });

  it('SPEC-UI-01: clicking a row selects and activates it', () => {
    const onSelect = vi.fn();
    const onActivate = vi.fn();
    render(<FindingList findings={[F1, F2]} onSelect={onSelect} onActivate={onActivate} />);
    fireEvent.click(screen.getAllByRole('option')[1] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith(F2.id);
    expect(onActivate).toHaveBeenCalledWith(F2.id);
  });

  it('PRD-F-07.2: re-verify rows say Remaining or Resolved in text, resolved rows after findings', () => {
    render(
      <FindingList
        findings={[F2]}
        changes={{ 'R-D-04:desktop': 'remaining' }}
        resolved={[
          {
            id: 'res:R-D-06:desktop',
            requirementId: 'R-D-06',
            viewport: 'desktop',
            title: 'Hero is back',
            label: 'explicit',
          },
        ]}
        onSelect={vi.fn()}
      />,
    );
    const opts = screen.getAllByRole('option');
    expect(opts[0]?.textContent).toContain('Remaining');
    expect(opts[1]?.textContent).toContain('Resolved');
    expect(opts[1]?.textContent).toContain('Hero is back');
  });

  it('SPEC-UI-04: a pre-computed finding is labelled Pre-computed', () => {
    render(
      <FindingList findings={[finding('R-D-05', { origin: 'precomputed', engine: 'cloud' })]} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole('option').textContent).toContain('Pre-computed');
  });

  it('empty list renders a note, not an empty listbox', () => {
    render(<FindingList findings={[]} onSelect={vi.fn()} />);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('SPEC-UI-01, PRD-F-05.4: ComparisonView', () => {
  it('shows design and implementation crops side by side with alt text from the statement', () => {
    render(<ComparisonView finding={F2} design={img()} capture={img()} />);
    expect(screen.getByRole('img', { name: /^Design: Statement of R-D-04/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /^Implementation: Statement of R-D-04/ })).toBeTruthy();
  });

  it('SPEC-UI-01: Diff overlay is an aria-pressed toggle that flips the overlay and its text note', () => {
    const { container } = render(<ComparisonView finding={F2} design={img()} capture={img()} />);
    const btn = screen.getByRole('button', { name: /Diff overlay/ });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('.evidence')?.classList.contains('show-diff')).toBe(false);
    expect(screen.getByText(/Diff overlay off/).textContent).toContain('40% of the region differs');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.evidence')?.classList.contains('show-diff')).toBe(true);
    expect(screen.getByText(/Diff overlay on/).textContent).toContain('magenta');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('SPEC-UI-01: Full page is an aria-pressed toggle that shows both whole images', () => {
    const { container } = render(<ComparisonView finding={F2} design={img()} capture={img()} />);
    const btn = screen.getByRole('button', { name: /Full page/ });
    expect(container.querySelector('.shot-scroll')).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('.shot-scroll').length).toBe(2);
  });

  it('a finding without a design shows the no-design block, with the condition for an Inferred item', () => {
    render(<ComparisonView finding={F4} capture={img(476, 844)} />);
    expect(screen.getByText('No Mobile design')).toBeTruthy();
    expect(screen.getByText(/Condition of I-M-01/)).toBeTruthy();
    expect(screen.queryByRole('img', { name: /^Design:/ })).toBeNull();
  });

  it('without images or crops it says the evidence could not be produced', () => {
    const bare = finding('R-D-09', { evidence: { measurements: [] } });
    render(<ComparisonView finding={bare} />);
    expect(screen.getByText(/Evidence could not be produced/)).toBeTruthy();
  });

  it('PRD-P-07: the diff note has no NaN or undefined when no diffRatio was measured', () => {
    const noRatio = finding('R-D-09', { evidence: { ...F2.evidence, diffRatio: undefined } });
    render(<ComparisonView finding={noRatio} design={img()} capture={img()} />);
    expect(screen.getByText(/Diff overlay off/).textContent).not.toMatch(/NaN|undefined/);
  });
});

describe('SPEC-UI-01, SPEC-UI-04: FindingDetail', () => {
  it('shows status, severity, statement as h2, measurements, fix, condition and selector', () => {
    const onCopyText = vi.fn();
    render(
      <FindingDetail finding={F2} requirement={req('R-D-04')} design={img()} capture={img()} onCopyText={onCopyText} />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Statement of R-D-04' })).toBeTruthy();
    expect(screen.getByText('Fail')).toBeTruthy();
    expect(screen.getByText('Major')).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Width')).toBeTruthy();
    expect(within(table).getByText('220 px')).toBeTruthy();
    expect(within(table).getByText('132 px')).toBeTruthy();
    expect(within(table).getByText('−88 px')).toBeTruthy();
    expect(within(table).getByText('design image + DOM snapshot')).toBeTruthy();
    expect(screen.getByText('Fix for R-D-04')).toBeTruthy();
    expect(screen.getByText('Condition of R-D-04')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy selector' }));
    expect(onCopyText).toHaveBeenCalledWith('main .hero a.btn-primary', 'Selector copied');
  });

  it('needs-review shows the review status, no severity word and the confidence', () => {
    render(<FindingDetail finding={F3} design={img()} capture={img()} />);
    expect(screen.getByText('Needs review')).toBeTruthy();
    expect(screen.queryByText('Minor')).toBeNull();
    expect(screen.getByText(/Low confidence/)).toBeTruthy();
  });

  it('SPEC-DEEP-04: a finding refined by cloud shows the Refined by Cloud label', () => {
    render(<FindingDetail finding={finding('R-D-05', { refinedBy: { engine: 'cloud', at: 1 }, engine: 'cloud' })} />);
    expect(screen.getByText('Refined by Cloud')).toBeTruthy();
  });

  it('an Inferred finding is tagged advisory; an Explicit one is not', () => {
    const { unmount } = render(<FindingDetail finding={F4} />);
    expect(screen.getByText('Inferred (advisory)')).toBeTruthy();
    unmount();
    render(<FindingDetail finding={F2} />);
    expect(screen.queryByText('Inferred (advisory)')).toBeNull();
    expect(screen.getByText('Explicit')).toBeTruthy();
  });

  it('a finding without measurements or selector omits those blocks', () => {
    render(<FindingDetail finding={finding('R-D-09', { evidence: { measurements: [] } })} />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy selector' })).toBeNull();
  });

  it('measurements with missing values and a % unit render dashes, not undefined', () => {
    const f = finding('R-D-09', {
      evidence: {
        measurements: [{ name: 'Gap', observed: 32, unit: '%', source: { observed: 'capture-image' } }],
      },
    });
    render(<FindingDetail finding={f} />);
    const t = screen.getByRole('table');
    expect(t.textContent).not.toMatch(/undefined|NaN/);
    expect(within(t).getByText('32%')).toBeTruthy();
  });
});

describe('SPEC-UI-01: EngineTrace', () => {
  it('lists steps with engine, duration and bytes, and totals what left the device', () => {
    render(
      <EngineTrace
        trace={[
          trace('measured desktop', { durationMs: 310 }),
          trace('judge R-D-05 desktop', { engine: 'on-device', durationMs: 4200 }),
          trace('deep', { engine: 'cloud', durationMs: 3100, bytesSent: 412 * 1024 }),
        ]}
      />,
    );
    const table = screen.getByRole('table');
    expect(within(table).getByText('Measured checks, Desktop')).toBeTruthy();
    expect(within(table).getByText('310 ms')).toBeTruthy();
    expect(within(table).getByText('4.2 s')).toBeTruthy();
    expect(within(table).getByText('412 KB')).toBeTruthy();
    expect(screen.getByText('412 KB sent, 1 cloud request')).toBeTruthy();
  });

  it('PRD-H: an on-device run says nothing left the device; an empty trace still renders', () => {
    const { unmount } = render(<EngineTrace trace={[trace('visual mobile')]} />);
    expect(screen.getByText('0 B sent off this device')).toBeTruthy();
    unmount();
    render(<EngineTrace trace={[]} />);
    expect(screen.getByText('0 B sent off this device')).toBeTruthy();
  });

  it('SPEC-DEMO-04: a pre-computed judged step reads "sample result"', () => {
    render(
      <EngineTrace trace={[trace('judge pre-computed', { engine: 'cloud', durationMs: 0, note: 'pre-computed' })]} />,
    );
    expect(screen.getByText('sample result')).toBeTruthy();
  });
});

describe('PRD-F-07.3, SPEC-RUN-11: RunHistory', () => {
  const runs: RunSummary[] = [
    {
      id: 'r2',
      createdAt: Date.UTC(2026, 10, 25, 15, 6),
      contractVersion: 1,
      viewports: ['desktop', 'mobile'],
      pass: 18,
      fail: 1,
      review: 0,
    },
    {
      id: 'r1',
      createdAt: Date.UTC(2026, 10, 25, 14, 32),
      contractVersion: 1,
      viewports: ['desktop'],
      pass: 11,
      fail: 6,
      review: 1,
    },
  ];
  it('lists runs newest first with counts and opens one', () => {
    const onOpen = vi.fn();
    render(<RunHistory runs={runs} currentRunId="r2" onOpen={onOpen} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Run 2');
    expect(items[0]?.textContent).toContain('1 fail');
    expect(items[1]?.textContent).toContain('6 fail, 1 needs review, 11 pass');
    expect(items[1]?.textContent).toContain('Contract v1');
    expect(
      within(items[0] as HTMLElement)
        .getByRole('button')
        .getAttribute('aria-current'),
    ).toBe('true');
    fireEvent.click(within(items[1] as HTMLElement).getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith('r1');
  });
  it('empty history says there are no runs yet', () => {
    render(<RunHistory runs={[]} onOpen={vi.fn()} />);
    expect(screen.getByText(/No runs yet/)).toBeTruthy();
  });
});

describe('PRD-F-04.4: RunProgress', () => {
  it('lists each stage with a state, and the progressbar reports the share done', () => {
    render(
      <RunProgress
        total={19}
        steps={[trace('measured desktop', { durationMs: 310 })]}
        current="Visual checks, Desktop"
        waiting={['Judged checks, Desktop']}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Checking 19 requirements' })).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Run progress' });
    expect(bar.getAttribute('aria-valuenow')).toBe('33');
    const stages = screen.getAllByRole('listitem');
    expect(stages.length).toBe(3);
    expect(stages[0]?.textContent).toContain('Measured checks, Desktop');
    expect(stages[0]?.textContent).toContain('310 ms');
    expect(stages[1]?.textContent).toContain('Running');
    expect(stages[2]?.textContent).toContain('Waiting');
  });
  it('no stages yet is 0 and never NaN', () => {
    render(<RunProgress total={0} steps={[]} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByRole('heading').textContent).toBe('Checking 0 requirements');
  });
  it('singular requirement and a Stop button when onStop is given', () => {
    const onStop = vi.fn();
    render(<RunProgress total={1} steps={[]} onStop={onStop} />);
    expect(screen.getByRole('heading').textContent).toBe('Checking 1 requirement');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalled();
  });
  it('needs-consent shows a status line while the run waits', () => {
    render(<RunProgress total={3} steps={[]} waitingConsent />);
    expect(screen.getByRole('status').textContent).toContain('Waiting for your choice');
  });
});

describe('SPEC-UI-06, PRD-F-05.4: RunScreen', () => {
  it('one h1, summary counts with icon + word, and the run-complete announcement', () => {
    mount();
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBe(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Run 1');
    const sum = screen.getByTestId('run-summary');
    expect(sum.textContent).toContain('3');
    expect(sum.textContent).toContain('fail');
    expect(sum.textContent).toContain('needs review');
    expect(sum.textContent).toContain('pass');
    expect(sum.textContent).toContain('not checked');
    expect(screen.getByText('Contract v1, locked')).toBeTruthy();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('Run complete: 3 fail, 1 needs review');
  });

  it('selects the first finding by default and shows its detail; Down moves the detail', () => {
    mount();
    expect(screen.getByRole('heading', { level: 2, name: 'Statement of R-D-06' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(screen.getByRole('heading', { level: 2, name: 'Statement of R-D-04' })).toBeTruthy();
  });

  it('SPEC-UI-01: selectedId (from ?f=) wins and onSelect is reported', () => {
    const onSelect = vi.fn();
    mount({ selectedId: F3.id, onSelect });
    expect(screen.getByRole('heading', { level: 2, name: 'Statement of R-D-05' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('option')[0] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith(F1.id);
  });

  it('an unknown selectedId falls back to the first finding', () => {
    mount({ selectedId: 'nope' });
    expect(screen.getByRole('heading', { level: 2, name: 'Statement of R-D-06' })).toBeTruthy();
  });

  it('viewport tabs are aria-pressed buttons with counts and filter the list', () => {
    mount();
    const group = screen.getByRole('group', { name: 'Viewport filter' });
    const all = within(group).getByRole('button', { name: /^All/ });
    const mobile = within(group).getByRole('button', { name: /^Mobile/ });
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(all.textContent).toContain('4');
    expect(mobile.textContent).toContain('1');
    fireEvent.click(mobile);
    expect(mobile.getAttribute('aria-pressed')).toBe('true');
    expect(all.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getAllByRole('option').length).toBe(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Statement of I-M-01' })).toBeTruthy();
  });

  it('a viewport with no findings shows the empty detail', () => {
    mount({ findings: [F1, F2] });
    fireEvent.click(screen.getByRole('button', { name: /^Mobile/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'No findings for this viewport' })).toBeTruthy();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('no findings at all says nothing needs fixing', () => {
    mount({ findings: [], summary: summary({ fail: 0, review: 0 }), run: run({ results: [] }) });
    expect(screen.getByRole('heading', { level: 2, name: 'Nothing to fix' })).toBeTruthy();
  });

  it('PRD-P-07: Passing lists requirement text and Not checked shows its reason', () => {
    mount();
    const passing = screen.getByText('Passing').closest('details') as HTMLElement;
    expect(passing.textContent).toContain('R-D-01');
    expect(passing.textContent).toContain('Requirement R-D-01');
    const nc = screen.getByTestId('not-checked');
    expect(nc.textContent).toContain('R-D-11');
    expect(nc.textContent).toContain('Not checked: the region is outside the capture');
  });

  it('SPEC-RUN-10, PRD-F-07.2: a re-verify run shows the four counts and resolved rows', () => {
    const rerun = run({
      results: [res('R-D-06', 'pass'), res('R-D-04', 'fail', { finding: F2 })],
      changes: { 'R-D-06:desktop': 'resolved', 'R-D-04:desktop': 'remaining' },
      baselineRunId: 'run_0',
    });
    mount({
      run: rerun,
      runNumber: 2,
      findings: [F2],
      summary: summary({
        pass: 1,
        fail: 1,
        review: 0,
        notChecked: 0,
        changes: { resolved: 1, remaining: 1, new: 0, regressed: 0, 'still-passing': 0 },
        line: '1 resolved, 1 remaining',
      }),
    });
    const sum = screen.getByTestId('run-summary');
    expect(sum.textContent).toContain('1 resolved');
    expect(sum.textContent).toContain('1 remaining');
    expect(sum.textContent).toContain('0 new');
    expect(sum.textContent).toContain('0 regressed');
    const opts = screen.getAllByRole('option');
    expect(opts.length).toBe(2);
    expect(opts[0]?.textContent).toContain('Remaining');
    expect(opts[1]?.textContent).toContain('Resolved');
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Re-verify complete: 1 resolved, 1 remaining',
    );
    fireEvent.click(opts[1] as HTMLElement);
    expect(screen.getByRole('heading', { level: 2, name: 'Resolved: Requirement R-D-06' })).toBeTruthy();
  });

  it('progress state: shows the stage list and no findings split while the run is in flight', () => {
    mount({
      run: undefined,
      findings: [],
      progress: { total: 19, steps: [trace('measured desktop')], current: 'Visual checks, Desktop' },
    });
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByText('Engine trace')).toBeNull();
  });

  it('stopped run: explains the partial results', () => {
    const stopped = { ...baseRun(), trace: [...baseRun().trace, trace('stopped', { note: 'Stopped' })] };
    mount({ run: stopped });
    const note = screen.getByTestId('stopped-note');
    expect(note.textContent).toContain('stopped');
    expect(note.textContent).toContain('partial');
  });

  it('error state: shows the alert with at most 5 detail lines and its actions', () => {
    mount({
      error: {
        title: 'The Mobile DOM snapshot could not be read.',
        details: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        actions: <a href="/x">Paste a new snapshot</a>,
      },
    });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('The Mobile DOM snapshot could not be read.');
    expect(alert.querySelectorAll('li').length).toBe(5);
    expect(within(alert).getByText('Paste a new snapshot')).toBeTruthy();
  });

  it('slots: notices and the deep action are rendered where the app puts them', () => {
    mount({ notices: <p>Sample results (pre-computed)</p>, deepSlot: <button type="button">Deep Analysis</button> });
    expect(screen.getByText('Sample results (pre-computed)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Deep Analysis' })).toBeTruthy();
  });

  it('actions: Re-verify and Copy fix prompt call back; Copy fix prompt is disabled with nothing to fix', () => {
    const { props } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Re-verify/ }));
    expect(props.onReverify).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Copy fix prompt/ }));
    expect(props.onCopyFixPrompt).toHaveBeenCalled();
    cleanup();
    mount({ findings: [], run: run() });
    expect((screen.getByRole('button', { name: /Copy fix prompt/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('More run actions menu: aria-expanded, Copy run ID closes it, Escape closes it', () => {
    const { props } = mount();
    const more = screen.getByRole('button', { name: 'More run actions' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Copy run ID/ }));
    expect(props.onCopyText).toHaveBeenCalledWith('run_7f3a91d2c21e', 'Run ID copied');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    fireEvent.keyDown(more.closest('.menu-wrap') as HTMLElement, { key: 'Escape' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
  });

  it('Export report sheet: Cancel focused first, Markdown default, Copy and Download report the choice', () => {
    const { props } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'More run actions' }));
    fireEvent.click(screen.getByRole('button', { name: /Export report/ }));
    const dlg = screen.getByRole('dialog', { name: 'Export report' });
    expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Cancel' }));
    expect((within(dlg).getByRole('radio', { name: /Markdown/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(dlg).getByRole('radio', { name: /JSON/ }));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Copy' }));
    expect(props.onExport).toHaveBeenCalledWith('json', 'copy');
    expect(screen.queryByRole('dialog', { name: 'Export report' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More run actions' }));
    fireEvent.click(screen.getByRole('button', { name: /Export report/ }));
    const again = screen.getByRole('dialog', { name: 'Export report' });
    fireEvent.click(within(again).getByRole('button', { name: /Download/ }));
    expect(props.onExport).toHaveBeenCalledWith('md', 'download');
  });

  it('Preview fix prompt sheet shows the read-only prompt text and Esc closes it', () => {
    mount({ fixPrompt: 'Fix the failing requirements below.' });
    fireEvent.click(screen.getByRole('button', { name: 'More run actions' }));
    fireEvent.click(screen.getByRole('button', { name: /Preview fix prompt/ }));
    const dlg = screen.getByRole('dialog', { name: 'Fix prompt' });
    const ta = within(dlg).getByRole('textbox') as HTMLTextAreaElement;
    expect(ta.readOnly).toBe(true);
    expect(ta.value).toBe('Fix the failing requirements below.');
    act(() => {
      fireEvent.keyDown(dlg, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog', { name: 'Fix prompt' })).toBeNull();
  });

  it('SPEC-UI-01: engine trace is included, run history only when more than one run exists', () => {
    mount();
    expect(screen.getByText('Engine trace')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Runs' })).toBeNull();
    cleanup();
    mount({
      history: [
        { id: 'a', createdAt: 2, contractVersion: 1, viewports: ['desktop'], pass: 1, fail: 0, review: 0 },
        { id: 'b', createdAt: 1, contractVersion: 1, viewports: ['desktop'], pass: 0, fail: 1, review: 0 },
      ],
      onOpenRun: vi.fn(),
    });
    expect(screen.getByRole('heading', { name: 'Runs' })).toBeTruthy();
  });

  it('no run and no progress renders a not-available notice, not a crash', () => {
    mount({ run: undefined, findings: [], progress: undefined });
    expect(screen.getByText(/not available/i)).toBeTruthy();
  });

  it('SPEC-UI-06: no hex colours or raw HTML injection in the component sources', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = 'src/features/run/ui';
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
    for (const f of files) {
      const text = readFileSync(`${dir}/${f}`, 'utf8');
      expect(text, f).not.toMatch(/#[0-9a-fA-F]{6}\b/);
      expect(text, f).not.toMatch(/dangerouslySetInnerHTML/);
    }
  });
});
