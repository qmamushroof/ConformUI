import { CuiError } from '@kernel';
import { ProjectsScreen } from '@projects';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeService, summary } from './shared';

afterEach(cleanup);

const withRun = summary({
  id: 'p2',
  name: 'Sample landing page',
  isSample: true,
  viewports: ['desktop', 'mobile'],
  runCount: 2,
  lastRun: { at: Date.UTC(2026, 10, 25, 12, 32), pass: 11, fail: 6, review: 1 },
});
const noRun = summary({
  id: 'p3',
  name: 'Northwind signup flow',
  viewports: ['desktop', 'mobile'],
  runCount: 0,
  hasContract: false,
});

function mount(list = [withRun, summary(), noRun], extra: Partial<ComponentProps<typeof ProjectsScreen>> = {}) {
  const service = fakeService({ list });
  const onOpen = vi.fn();
  render(<ProjectsScreen service={service} onOpen={onOpen} sampleHref="/p/sample" {...extra} />);
  return { service, onOpen };
}

describe('SPEC-UI-05, PRD-F-01.2: ProjectsScreen list', () => {
  it('SPEC-UI-06: shows a loading status first, then one h1 and the count', async () => {
    mount();
    expect(screen.getByText('Loading projects').getAttribute('role')).toBe('status');
    await screen.findByText('3 projects, stored on this device');
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Projects']);
  });

  it('PRD-F-01.2: a card shows name, Sample tag, viewports, last run and counts as icon plus text', async () => {
    mount();
    const card = (await screen.findByRole('heading', { name: 'Sample landing page' })).closest('li') as HTMLElement;
    expect(within(card).getByText('Sample')).toBeTruthy();
    expect(within(card).getByText('Desktop 1440')).toBeTruthy();
    expect(within(card).getByText('Mobile 390')).toBeTruthy();
    expect(within(card).getByText(/Last run 25 Nov 2026/)).toBeTruthy();
    const counts = within(card).getByLabelText('Last run: 6 fail, 1 needs review, 11 pass');
    expect(counts.querySelectorAll('svg[aria-hidden="true"]').length).toBe(3);
    expect(counts.textContent).toBe('6 fail1 needs review11 pass');
  });

  it('PRD-F-01.2: zero counts are left out; a missing viewport says No Mobile capture', async () => {
    mount([summary({ lastRun: { at: 1, pass: 14, fail: 2, review: 0 } })]);
    const card = (await screen.findByRole('heading', { name: 'Field ops pricing page' })).closest('li') as HTMLElement;
    expect(within(card).getByText('No Mobile capture')).toBeTruthy();
    expect(within(card).queryByText(/needs review/)).toBeNull();
  });

  it('PRD-F-01.2: a project without runs says No runs yet, its creation date and Contract not extracted', async () => {
    mount([noRun]);
    expect(await screen.findByText('No runs yet')).toBeTruthy();
    expect(screen.getByText('Created 24 Nov 2026')).toBeTruthy();
    expect(screen.getByText('Contract not extracted')).toBeTruthy();
  });

  it('SPEC-UI-06: a single project reads "1 project"', async () => {
    mount([noRun]);
    expect(await screen.findByText('1 project, stored on this device')).toBeTruthy();
  });

  it('SPEC-UI-06: a card link opens the project through onOpen and keeps a real href', async () => {
    const { onOpen } = mount();
    const link = (await screen.findByRole('heading', { name: 'Northwind signup flow' })).closest(
      'a',
    ) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/p/p3');
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledWith('p3');
  });

  it('SPEC-UI-06: a modified click (new tab) is left to the browser', async () => {
    const { onOpen } = mount();
    const link = (await screen.findByRole('heading', { name: 'Northwind signup flow' })).closest(
      'a',
    ) as HTMLAnchorElement;
    fireEvent.click(link, { ctrlKey: true });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('PRD-F-01.2: shows the privacy footnote with a link to Privacy and data', async () => {
    mount();
    const note = await screen.findByText(/stay in this browser/);
    const link = within(note.parentElement as HTMLElement).getByRole('link', { name: 'Privacy and data' });
    expect(link.getAttribute('href')).toBe('/settings#privacy');
  });
});

describe('SPEC-UI-05, PRD-F-01.4: empty and error states', () => {
  it('SPEC-UI-05: empty state names the loop and offers the sample and New project', async () => {
    mount([]);
    expect(await screen.findByRole('heading', { name: 'No projects yet' })).toBeTruthy();
    const loop = screen.getByRole('list', { name: 'How it works' });
    expect(
      within(loop)
        .getAllByRole('listitem')
        .map((l) => l.textContent),
    ).toEqual(['1Contract', '2Run', '3Fix prompt', '4Re-verify']);
    expect(screen.getByRole('link', { name: 'Try the sample' }).getAttribute('href')).toBe('/p/sample');
    expect(screen.getAllByRole('button', { name: 'New project' }).length).toBeGreaterThan(0);
  });

  it('SPEC-APP-03, SPEC-UI-05: a list failure shows the danger notice with its code and a Reload action', async () => {
    const service = fakeService();
    service.list.mockRejectedValueOnce(new CuiError('STORAGE_UNAVAILABLE'));
    const onReload = vi.fn();
    render(<ProjectsScreen service={service} onOpen={vi.fn()} sampleHref="/p/sample" onReload={onReload} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't open local storage. Nothing was deleted.");
    expect(alert.textContent).toContain('STORAGE_UNAVAILABLE');
    fireEvent.click(within(alert).getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalled();
  });
});

describe('PRD-F-01.1, PRD-F-02.3: New project sheet', () => {
  const open = async () => {
    const r = mount([withRun]);
    await screen.findByText('1 project, stored on this device');
    fireEvent.click(screen.getAllByRole('button', { name: 'New project' })[0] as HTMLElement);
    return { ...r, dlg: await screen.findByRole('dialog', { name: 'New project' }) };
  };

  it('SPEC-UI-06: focuses the name field, Desktop and Mobile checked, Tablet disabled', async () => {
    const { dlg } = await open();
    expect(document.activeElement).toBe(within(dlg).getByLabelText('Project name'));
    expect((within(dlg).getByLabelText('Desktop 1440') as HTMLInputElement).checked).toBe(true);
    expect((within(dlg).getByLabelText('Mobile 390') as HTMLInputElement).checked).toBe(true);
    expect((within(dlg).getByLabelText(/Tablet 768/) as HTMLInputElement).disabled).toBe(true);
    expect(within(dlg).getByText('Coming later')).toBeTruthy();
  });

  it('PRD-F-01.1: an empty name shows the error and does not create', async () => {
    const { service, dlg } = await open();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Create project' }));
    expect(within(dlg).getByText('Give the project a name')).toBeTruthy();
    expect(within(dlg).getByLabelText('Project name').getAttribute('aria-invalid')).toBe('true');
    expect(service.create).not.toHaveBeenCalled();
  });

  it('PRD-F-01.1: a whitespace-only name is rejected too', async () => {
    const { service, dlg } = await open();
    fireEvent.change(within(dlg).getByLabelText('Project name'), { target: { value: '   ' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Create project' }));
    expect(service.create).not.toHaveBeenCalled();
  });

  it('PRD-F-01.1: with no viewport picked it asks for at least one', async () => {
    const { service, dlg } = await open();
    fireEvent.change(within(dlg).getByLabelText('Project name'), { target: { value: 'Checkout' } });
    fireEvent.click(within(dlg).getByLabelText('Desktop 1440'));
    fireEvent.click(within(dlg).getByLabelText('Mobile 390'));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Create project' }));
    expect(within(dlg).getByText('Pick at least one viewport')).toBeTruthy();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('PRD-F-01.1: creates with the trimmed name and opens the project with the chosen viewports', async () => {
    const { service, onOpen, dlg } = await open();
    fireEvent.change(within(dlg).getByLabelText('Project name'), { target: { value: '  Checkout page ' } });
    fireEvent.click(within(dlg).getByLabelText('Mobile 390'));
    await act(async () => {
      fireEvent.click(within(dlg).getByRole('button', { name: 'Create project' }));
    });
    expect(service.create).toHaveBeenCalledWith('Checkout page');
    expect(onOpen).toHaveBeenCalledWith('new1', ['desktop']);
  });

  it('SPEC-UI-06: Cancel closes the sheet without creating', async () => {
    const { service, dlg } = await open();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New project' })).toBeNull());
    expect(service.create).not.toHaveBeenCalled();
  });
});

describe('PRD-F-01.1, PRD-F-01.3: card menu, rename, delete', () => {
  const menu = async (name: string, list = [withRun, summary(), noRun]) => {
    const r = mount(list);
    await screen.findByRole('heading', { name });
    fireEvent.click(screen.getByRole('button', { name: `More actions for ${name}` }));
    return r;
  };

  it('SPEC-UI-06: the menu button reports expanded and lists Rename, Export contract and Delete', async () => {
    await menu('Field ops pricing page');
    const btn = screen.getByRole('button', { name: 'More actions for Field ops pricing page' });
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.getAttribute('aria-haspopup')).toBe('true');
    expect(screen.getByRole('button', { name: 'Rename' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export contract' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Delete/ })).toBeTruthy();
  });

  it('PRD-F-01.3: Export contract is aria-disabled with a reason when there is no contract', async () => {
    const onExportContract = vi.fn();
    mount(undefined, { onExportContract });
    await screen.findByRole('heading', { name: 'Northwind signup flow' });
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Northwind signup flow' }));
    const exp = screen.getByRole('button', { name: 'Export contract: none yet' });
    expect(exp.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(exp);
    expect(onExportContract).not.toHaveBeenCalled();
  });

  it('PRD-F-01.3: Export contract calls onExportContract for a project that has one', async () => {
    const onExportContract = vi.fn();
    mount(undefined, { onExportContract });
    await screen.findByRole('heading', { name: 'Field ops pricing page' });
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Field ops pricing page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export contract' }));
    expect(onExportContract).toHaveBeenCalledWith('p1');
  });

  it('PRD-F-01.3: rename saves the trimmed name, refreshes the list and rejects an empty name', async () => {
    const { service } = await menu('Field ops pricing page');
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const dlg = await screen.findByRole('dialog', { name: 'Rename project' });
    const input = within(dlg).getByLabelText('Project name') as HTMLInputElement;
    expect(input.value).toBe('Field ops pricing page');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Save name' }));
    expect(within(dlg).getByText('Give the project a name')).toBeTruthy();
    expect(service.rename).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: ' Pricing ' } });
    await act(async () => {
      fireEvent.click(within(dlg).getByRole('button', { name: 'Save name' }));
    });
    expect(service.rename).toHaveBeenCalledWith('p1', 'Pricing');
    expect(service.list.mock.calls.length).toBeGreaterThan(1);
    expect(screen.getByRole('status').textContent).toContain('Renamed to Pricing');
  });

  it('PRD-F-01.1: delete needs the typed name, focuses Cancel first and names the run count', async () => {
    const { service } = await menu('Field ops pricing page');
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
    const dlg = await screen.findByRole('dialog', { name: /Delete project/ });
    expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Cancel' }));
    expect(dlg.textContent).toContain('3 runs');
    const go = within(dlg).getByRole('button', { name: 'Delete project' });
    expect(go.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(go);
    expect(service.remove).not.toHaveBeenCalled();
    const confirm = within(dlg).getByLabelText(/Type .* to confirm/);
    fireEvent.change(confirm, { target: { value: 'field ops' } });
    expect(go.getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(confirm, { target: { value: ' Field ops pricing page ' } });
    expect(go.getAttribute('aria-disabled')).toBe('false');
    await act(async () => {
      fireEvent.click(go);
    });
    expect(service.remove).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('status').textContent).toContain('Deleted Field ops pricing page');
  });

  it('PRD-F-01.1: one run reads "1 run"', async () => {
    await menu('Field ops pricing page', [summary({ runCount: 1 })]);
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
    expect((await screen.findByRole('dialog', { name: /Delete project/ })).textContent).toContain('1 run ');
  });

  it('PRD-F-01.1: deleting the last project shows the empty state', async () => {
    const { service } = await menu('Field ops pricing page', [summary()]);
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
    const dlg = await screen.findByRole('dialog', { name: /Delete project/ });
    fireEvent.change(within(dlg).getByLabelText(/Type .* to confirm/), { target: { value: 'Field ops pricing page' } });
    service.list.mockResolvedValue([]);
    await act(async () => {
      fireEvent.click(within(dlg).getByRole('button', { name: 'Delete project' }));
    });
    expect(await screen.findByRole('heading', { name: 'No projects yet' })).toBeTruthy();
  });
});
