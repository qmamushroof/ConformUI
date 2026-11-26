import {
  ContractScreen,
  type ContractScreenProps,
  type ContractService,
  RequirementEditor,
  RequirementRow,
} from '@contract';
import type { Contract, Project, Requirement } from '@kernel';
import { EngineBadge } from '@settings';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const req = (id: string, o: Partial<Requirement> = {}): Requirement => ({
  id,
  viewport: 'desktop',
  category: 'size',
  label: 'explicit',
  checkType: 'measured',
  statement: `Statement ${id}`,
  condition: `Condition ${id}`,
  check: { kind: 'presence', match: { text: id } },
  region: { rect: { x: 64, y: 440, w: 220, h: 56 }, source: 'snapped' },
  accepted: true,
  origin: 'ai',
  engine: 'on-device',
  ...o,
});

const contract = (reqs: Requirement[], o: Partial<Contract> = {}): Contract => ({
  id: 'ctr_1',
  projectId: 'p1',
  version: 1,
  createdAt: 0,
  locked: false,
  requirements: reqs,
  ...o,
});

const project = (o: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Sample landing page',
  createdAt: 0,
  updatedAt: 0,
  isSample: false,
  designs: [
    {
      id: 'd1',
      viewport: 'desktop',
      image: { blobId: 'b', mime: 'image/png', width: 1440, height: 1000, cssWidth: 1440, bytes: 1 },
      addedAt: 0,
    },
  ],
  captures: [],
  cloudUsage: { requests: 0, bytes: 0 },
  ...o,
});

type Svc = Pick<ContractService, 'accept' | 'editText' | 'remove' | 'add'>;
const service = (next: Contract) => ({
  accept: vi.fn(async (..._a: unknown[]) => next),
  editText: vi.fn(async (..._a: unknown[]) => next),
  remove: vi.fn(async (..._a: unknown[]) => next),
  add: vi.fn(async (..._a: unknown[]) => next),
});
const asSvc = (s: ReturnType<typeof service>) => s as unknown as Svc;

const base = () =>
  contract([
    req('R-01'),
    req('R-02', { accepted: false }),
    req('I-M-01', { viewport: 'mobile', label: 'inferred', origin: 'rule', region: undefined }),
  ]);

function mount(o: Partial<ContractScreenProps> = {}) {
  const c = o.contract ?? base();
  const svc = service(c);
  const props: ContractScreenProps = {
    project: project(),
    contract: c,
    service: asSvc(svc),
    onExtract: vi.fn(),
    onExport: vi.fn(),
    onChange: vi.fn(),
    renderBadge: (r) => <EngineBadge engine={r.engine ?? 'measured'} origin={r.origin} />,
    ...o,
  };
  render(<ContractScreen {...props} />);
  return { props, svc };
}

describe('SPEC-CON-08: RequirementRow', () => {
  it('SPEC-CON-08: shows id, category, check type, statement and an engine badge as text plus icon', () => {
    render(
      <ul>
        <RequirementRow requirement={req('R-01')} selected={false} badge={<EngineBadge engine="on-device" />} />
      </ul>,
    );
    const row = screen.getByRole('option');
    expect(row.textContent).toContain('R-01');
    expect(row.textContent).toContain('Size');
    expect(row.textContent).toContain('Measured');
    expect(row.textContent).toContain('Statement R-01');
    expect(within(row).getByLabelText('Produced by on-device model').textContent).toContain('On-device');
    expect(row.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('SPEC-CON-08, PRD-P-12: an inferred item says Inferred in text, and an unaccepted one says Not reviewed', () => {
    render(
      <ul>
        <RequirementRow requirement={req('I-M-01', { label: 'inferred', accepted: false })} selected={false} />
      </ul>,
    );
    const row = screen.getByRole('option');
    expect(row.textContent).toContain('Inferred');
    expect(row.textContent).toContain('Not reviewed');
  });

  it('SPEC-CON-07: an unresolved region is flagged on the row', () => {
    render(
      <ul>
        <RequirementRow
          requirement={req('R-09', { region: { unresolved: true, suggested: { x: 1, y: 2, w: 3, h: 4 } } })}
          selected
        />
      </ul>,
    );
    expect(screen.getByRole('option').textContent).toContain('Needs review: region not found');
    expect(screen.getByRole('option').getAttribute('aria-selected')).toBe('true');
  });
});

describe('SPEC-CON-08, SPEC-UI-01: ContractScreen list and detail', () => {
  it('SPEC-CON-08: groups rows by viewport with counts and a labelled listbox', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Contract v1');
    const list = screen.getByRole('listbox', { name: 'Requirements, grouped by viewport' });
    expect(within(list).getAllByRole('option').length).toBe(3);
    expect(list.textContent).toContain('Desktop 1440 · 2');
    expect(list.textContent).toContain('Mobile 390 · 1');
  });

  it('SPEC-UI-01: selecting a row shows its statement, condition and status via aria-selected', () => {
    mount();
    fireEvent.click(screen.getByRole('option', { name: /Statement R-02/ }));
    expect(screen.getByRole('option', { name: /Statement R-02/ }).getAttribute('aria-selected')).toBe('true');
    const detail = document.getElementById('detail') as HTMLElement;
    expect(detail.textContent).toContain('Statement R-02');
    expect(detail.textContent).toContain('Condition R-02');
    expect(detail.textContent).toContain('Not accepted: not verified until accepted');
  });

  it('SPEC-UI-06: Down, Up and Home move the selection in the listbox (keyboard only)', () => {
    mount();
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /Statement R-02/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' }); // clamps at the last row
    expect(screen.getByRole('option', { name: /Statement I-M-01/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(screen.getByRole('option', { name: /Statement R-02/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(list, { key: 'Home' });
    expect(screen.getByRole('option', { name: /Statement R-01/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('SPEC-CON-07: hover and focus on a row highlight its region; an unresolved region is dashed', () => {
    const c = contract([
      req('R-01'),
      req('R-02', { region: { unresolved: true, suggested: { x: 64, y: 330, w: 520, h: 80 } } }),
    ]);
    mount({ contract: c });
    const row = screen.getByRole('option', { name: /Statement R-01/ });
    fireEvent.mouseOver(row);
    expect(document.querySelector('.rg[data-id="R-01"]')?.classList.contains('hl')).toBe(true);
    fireEvent.mouseOut(row);
    expect(document.querySelector('.rg[data-id="R-01"]')?.classList.contains('hl')).toBe(false);
    fireEvent.focus(row);
    expect(document.querySelector('.rg[data-id="R-01"]')?.classList.contains('hl')).toBe(true);
    fireEvent.click(screen.getByRole('option', { name: /Statement R-02/ }));
    expect(document.querySelector('.rg[data-id="R-02"]')?.classList.contains('unres')).toBe(true);
    expect(document.getElementById('detail')?.textContent).toContain('Region not found: image checks need review');
  });

  it('SPEC-CON-07: clicking a region outline selects its requirement', () => {
    mount({
      contract: contract([
        req('R-01'),
        req('R-02', { region: { rect: { x: 1, y: 1, w: 9, h: 9 }, source: 'snapped' } }),
      ]),
    });
    fireEvent.click(document.querySelector('.rg[data-id="R-02"]') as Element);
    expect(screen.getByRole('option', { name: /Statement R-02/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('SPEC-CON-08: an empty contract shows no rows and no crash', () => {
    mount({ contract: contract([]) });
    expect(screen.queryAllByRole('option').length).toBe(0);
    expect(screen.getByText('No requirement selected')).toBeTruthy();
  });
});

describe('SPEC-CON-05, SPEC-CON-06: review actions', () => {
  it('SPEC-CON-05: Accept all calls the service with "all" and reports the new contract', async () => {
    const { props, svc } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Accept all/ }));
    await waitFor(() => expect(props.onChange).toHaveBeenCalled());
    expect(svc.accept).toHaveBeenCalledWith('ctr_1', 'all');
  });

  it('SPEC-CON-05: a row Accept accepts only that id', async () => {
    const { svc } = mount();
    fireEvent.click(screen.getByRole('option', { name: /Statement R-02/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(svc.accept).toHaveBeenCalledWith('ctr_1', ['R-02']));
  });

  it('SPEC-CON-05: Delete removes the selected requirement', async () => {
    const { svc } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(svc.remove).toHaveBeenCalledWith('ctr_1', 'R-01'));
  });

  it('SPEC-CON-05: Edit saves statement and condition; an empty statement is refused with an error', async () => {
    const { svc } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const st = screen.getByLabelText('Statement') as HTMLTextAreaElement;
    fireEvent.change(st, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(svc.editText).not.toHaveBeenCalled();
    expect(screen.getByText('The statement can’t be empty.')).toBeTruthy();
    expect(st.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(st, { target: { value: ' New words ' } });
    fireEvent.change(screen.getByLabelText('Passes when'), { target: { value: 'Width is 10 px' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(svc.editText).toHaveBeenCalledWith('ctr_1', 'R-01', {
        statement: 'New words',
        condition: 'Width is 10 px',
      }),
    );
  });

  it('SPEC-CON-06: a locked contract shows the lock notice and no row actions until Edit as v2', () => {
    mount({ contract: contract([req('R-01')], { locked: true }), lockedBy: 'Run 1' });
    expect(screen.getByText('Locked by Run 1. Editing creates Contract v2.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Accept all/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Edit as v2/ }));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('SPEC-CON-05: a failing service call is announced as an alert, not thrown', async () => {
    const c = contract([req('R-01')]);
    const svc = service(c);
    svc.remove.mockRejectedValueOnce(new Error('boom'));
    mount({ contract: c, service: asSvc(svc) });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect((await screen.findByRole('alert')).textContent).toContain('boom');
  });
});

describe('SPEC-CON-08: Add requirement', () => {
  it('SPEC-CON-08: validates statement and condition, then calls the service with a draft', async () => {
    const { svc } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Add requirement/ }));
    const dlg = await screen.findByRole('dialog', { hidden: true });
    const go = () => within(dlg).getByRole('button', { name: /^Add requirement$/, hidden: true });
    fireEvent.click(go());
    expect(svc.add).not.toHaveBeenCalled();
    expect(within(dlg).getByText('Write what must be true, in one sentence.')).toBeTruthy();
    expect(within(dlg).getByText(/Say when it passes/)).toBeTruthy();
    fireEvent.change(within(dlg).getByLabelText('Statement'), { target: { value: 'Pricing link is in the nav' } });
    fireEvent.change(within(dlg).getByLabelText('Passes when'), { target: { value: 'Nav has Pricing' } });
    fireEvent.click(within(dlg).getByLabelText(/Judged/));
    fireEvent.click(go());
    await waitFor(() => expect(svc.add).toHaveBeenCalled());
    expect(svc.add.mock.calls[0]?.[1]).toMatchObject({
      viewport: 'desktop',
      statement: 'Pricing link is in the nav',
      condition: 'Nav has Pricing',
      checkType: 'judged',
      check: { kind: 'judged' },
    });
  });

  it('SPEC-UI-06: RequirementEditor Cancel and Esc call onCancel without saving', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<RequirementEditor viewport="desktop" onSave={onSave} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole('dialog', { hidden: true }), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', hidden: true }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('SPEC-CON-08: a statement over 160 characters is refused', () => {
    const onSave = vi.fn();
    render(<RequirementEditor viewport="mobile" onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Statement'), { target: { value: 'x'.repeat(161) } });
    fireEvent.change(screen.getByLabelText('Passes when'), { target: { value: 'ok' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add requirement$/, hidden: true }));
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('SPEC-UI-01, PRD-F-04.4: Extract and Export', () => {
  it('SPEC-UI-01: Extract is disabled without a design, explains why, and does nothing when pressed', () => {
    const { props } = mount({ project: project({ designs: [] }), contract: undefined });
    const btn = screen.getByRole('button', { name: /Extract contract/ });
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(/Extract contract needs a design/)).toBeTruthy();
    expect(btn.getAttribute('aria-describedby')).toBeTruthy();
    fireEvent.click(btn);
    expect(props.onExtract).not.toHaveBeenCalled();
    expect(screen.getByText('No design image yet')).toBeTruthy();
  });

  it('SPEC-UI-01: Extract calls onExtract when a design exists', () => {
    const { props } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Extract contract/ }));
    expect(props.onExtract).toHaveBeenCalledTimes(1);
  });

  it('SPEC-EXP-02: the More menu exports Markdown and JSON', () => {
    const { props } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'More contract actions' }));
    fireEvent.click(screen.getByRole('button', { name: /Export contract as Markdown/ }));
    expect(props.onExport).toHaveBeenCalledWith('md');
    fireEvent.click(screen.getByRole('button', { name: 'More contract actions' }));
    fireEvent.click(screen.getByRole('button', { name: /Export contract as JSON/ }));
    expect(props.onExport).toHaveBeenCalledWith('json');
  });

  it('PRD-F-04.4: extracting shows a progressbar per stage with values, and Stop extracting', () => {
    const onStop = vi.fn();
    mount({
      extracting: {
        engine: 'on-device',
        viewportLabel: 'Desktop',
        stages: [
          { label: 'Band 1 of 2', state: 'done', detail: '6.4 s, 15 found', percent: 100 },
          { label: 'Band 2 of 2', state: 'run', detail: '40%', percent: 40 },
          { label: 'Snap regions', state: 'wait', detail: 'Waiting', percent: 0 },
        ],
      },
      onStopExtract: onStop,
    });
    const bars = screen.getAllByRole('progressbar');
    expect(bars.map((b) => b.getAttribute('aria-valuenow'))).toEqual(['100', '40', '0']);
    expect(screen.getByText('Extracting requirements from the Desktop design')).toBeTruthy();
    expect(screen.getByText('Nothing is sent off this device.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stop extracting' }));
    expect(onStop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Extract contract/ }).getAttribute('aria-busy')).toBe('true');
  });

  it('PRD-P-12: an extraction error is an alert with its code', () => {
    mount({
      extractError: { title: 'Band 2 could not be read.', detail: 'Add requirements by hand.', code: 'AI_BAD_OUTPUT' },
    });
    const a = screen.getByRole('alert');
    expect(a.textContent).toContain('Band 2 could not be read.');
    expect(a.textContent).toContain('AI_BAD_OUTPUT');
  });
});

describe('SPEC-DEMO-03: review draft and sample comparison', () => {
  const pending = () =>
    contract([req('R-01', { accepted: false }), req('R-02', { accepted: false }), req('R-03', { accepted: false })], {
      id: 'ctr_ai',
    });

  it('SPEC-DEMO-03: shows "AI proposed N requirements; M match the verified contract" and the two choices', () => {
    const onUse = vi.fn();
    const onKeep = vi.fn();
    mount({
      pending: pending(),
      comparison: { matched: ['R-01', 'R-02'], missing: ['R-09'], extra: ['R-03'] },
      onUseAi: onUse,
      onKeepVerified: onKeep,
    });
    expect(
      screen.getByRole('heading', { name: 'AI proposed 3 requirements; 2 match the verified contract' }),
    ).toBeTruthy();
    expect(screen.getByText('Missed by AI')).toBeTruthy();
    expect(screen.getByText('Extra from AI')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use AI contract' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep verified contract' }));
    expect(onUse).toHaveBeenCalledTimes(1);
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it('SPEC-DEMO-03: zero matches and singular wording stay correct', () => {
    mount({
      pending: contract([req('R-01', { accepted: false })], { id: 'ctr_ai' }),
      comparison: { matched: [], missing: ['R-02'], extra: ['R-01'] },
    });
    expect(
      screen.getByRole('heading', { name: 'AI proposed 1 requirement; 0 match the verified contract' }),
    ).toBeTruthy();
  });

  it('SPEC-CON-09: the draft is titled as not active, lists its rows and accepts them via its own id', async () => {
    const { svc } = mount({ pending: pending() });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('AI contract (draft)');
    expect(screen.getByText('Not active: runs use the verified contract v1')).toBeTruthy();
    expect(screen.getByText(/AI extracted 3 requirements, On-device\. Review them, then accept\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Accept all/ }));
    await waitFor(() => expect(svc.accept).toHaveBeenCalledWith('ctr_ai', 'all'));
  });

  it('PRD-P-06: a pre-computed draft is labelled as such, not as AI', () => {
    mount({ pending: pending(), pendingSource: 'precomputed' });
    expect(
      screen.getByText(/Sample results \(pre-computed\): 3 requirements\. Review them, then accept\./),
    ).toBeTruthy();
  });
});
