import type { Project } from '@kernel';
import { OnboardingScreen, SettingsScreen } from '@settings';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeSettings } from './shared';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
});

const project = (id: string, name: string, o: Partial<Project> = {}): Project => ({
  id,
  name,
  createdAt: 0,
  updatedAt: 0,
  isSample: false,
  designs: [],
  captures: [],
  cloudUsage: { requests: 0, bytes: 0 },
  ...o,
});

const consented = (id: string, name: string, requests = 0, bytes = 0) =>
  project(id, name, { cloudConsent: { grantedAt: Date.UTC(2026, 10, 25, 12) }, cloudUsage: { requests, bytes } });

function mount(
  o: {
    settings?: ReturnType<typeof fakeSettings>;
    projects?: Project[];
    onRevoke?: (id: string) => Promise<void>;
    onCleared?: () => void;
    usage?: { projects: number; images: number; contracts: number; runs: number; bytes: number };
  } = {},
) {
  const settings = o.settings ?? fakeSettings();
  const onRevoke = o.onRevoke ?? vi.fn(async () => {});
  const loadProjects = vi.fn(async () => o.projects ?? []);
  render(
    <SettingsScreen
      settings={settings}
      loadProjects={loadProjects}
      onRevoke={onRevoke}
      onCleared={o.onCleared}
      usage={o.usage}
    />,
  );
  return { settings, onRevoke, loadProjects };
}

describe('SPEC-SET-01, SPEC-UI-06: SettingsScreen structure', () => {
  it('SPEC-UI-06: has one h1, a labelled section nav and the six section headings', async () => {
    mount();
    await screen.findByText('On-device model ready. First pass stays on this device.');
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBe(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Settings');
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Engine', 'Mode', 'Cloud consent', 'Privacy', 'Data', 'About']);
    for (const h of ['Engine', 'Mode', 'Cloud consent', 'Privacy', 'Data', 'About']) {
      expect(screen.getByRole('heading', { level: 2, name: h })).toBeTruthy();
    }
  });

  it('SPEC-SET-01: renders the engine panel from the service and offers download when canDownload', async () => {
    const settings = fakeSettings({
      view: { device: 'downloadable', canDownload: true, imageOnDevice: 'unknown' },
    });
    mount({ settings });
    fireEvent.click(await screen.findByRole('button', { name: 'Download model' }));
    await waitFor(() => expect(settings.downloadModel).toHaveBeenCalledTimes(1));
  });

  it('SPEC-SET-03: download progress comes from the service callback and ends with the refreshed view', async () => {
    let report: (p: number) => void = () => {};
    let finish: () => void = () => {};
    const settings = fakeSettings({ view: { device: 'downloadable', canDownload: true } });
    settings.downloadModel.mockImplementation(
      (cb) =>
        new Promise((res) => {
          report = cb;
          finish = () => res({ ...settingsView(), device: 'available' });
        }),
    );
    mount({ settings });
    fireEvent.click(await screen.findByRole('button', { name: 'Download model' }));
    await screen.findByRole('progressbar');
    act(() => report(0.42));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('42');
    act(() => report(0.95));
    expect(screen.getByText(/still finishing/)).toBeTruthy();
    await act(async () => finish());
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('On-device model ready. First pass stays on this device.')).toBeTruthy();
  });

  it('SPEC-SET-03: a failed download shows an alert and returns to the Download button', async () => {
    const settings = fakeSettings({ view: { device: 'downloadable', canDownload: true } });
    settings.downloadModel.mockRejectedValue(new Error('DEVICE_UNAVAILABLE'));
    mount({ settings });
    fireEvent.click(await screen.findByRole('button', { name: 'Download model' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t download the model');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Download model' })).toBeTruthy();
  });

  it('SPEC-SET-01: shows the enable steps for a Chrome with the flag off', async () => {
    const settings = fakeSettings({
      view: {
        device: 'unavailable',
        reason: 'image-flag-off',
        enableSteps: ['a'],
        imageOnDevice: false,
      },
    });
    mount({ settings });
    await screen.findByRole('heading', { name: 'Turn on image input in Chrome' });
    expect(screen.getAllByRole('button', { name: 'Copy flag address' }).length).toBe(2);
  });
});

function settingsView() {
  return {
    device: 'available' as const,
    headline: '',
    detail: '',
    canDownload: false,
    imageOnDevice: true as const,
    online: true,
    cloud: 'enabled' as const,
    mode: 'auto' as const,
  };
}

describe('SPEC-SET-04, PRD-H-04: mode radios', () => {
  it('SPEC-SET-04: three radios with one-line explanations, the current mode checked', async () => {
    mount({ settings: fakeSettings({ mode: 'cloud-only' }) });
    const group = await screen.findByRole('group', { name: 'AI mode' });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual(['auto', 'cloud-only', 'on-device-only']);
    expect(radios.map((r) => r.checked)).toEqual([false, true, false]);
    expect(screen.getByText('On-device first. Cloud only for projects you allow.')).toBeTruthy();
    expect(screen.getByText(/Never use the cloud\. AI steps wait/)).toBeTruthy();
  });

  it('SPEC-SET-04: choosing a mode calls setMode and announces that it applies to the next request', async () => {
    const { settings } = mount();
    fireEvent.click(await screen.findByRole('radio', { name: /^Cloud only/ }));
    await waitFor(() => expect(settings.setMode).toHaveBeenCalledWith('cloud-only'));
    expect(await screen.findByText('Mode: Cloud only. Applies to the next request.')).toBeTruthy();
    expect(screen.getByText('Mode', { selector: 'dt' }).nextElementSibling?.textContent).toBe('Cloud only');
  });

  it('SPEC-SET-04: a failing setMode reverts the radio and says so', async () => {
    const settings = fakeSettings();
    settings.setMode.mockRejectedValue(new Error('x'));
    mount({ settings });
    const cloud = (await screen.findByRole('radio', { name: /^Cloud only/ })) as HTMLInputElement;
    fireEvent.click(cloud);
    await screen.findByText('Couldn’t save the mode. Nothing changed.');
    expect((screen.getByRole('radio', { name: /^Auto/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('SPEC-SET-04: On-device only is disabled and explained when the browser has no on-device model', async () => {
    mount({ settings: fakeSettings({ view: { device: 'unavailable', reason: 'not-desktop-chrome' } }) });
    const r = (await screen.findByRole('radio', { name: /On-device only/ })) as HTMLInputElement;
    expect(r.disabled).toBe(true);
    expect(screen.getByText('Not available: this browser has no on-device model.')).toBeTruthy();
    expect(r.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('SPEC-UI-06: the radios are reachable and operable by keyboard (native radio group)', async () => {
    mount();
    const radios = (await screen.findAllByRole('radio')) as HTMLInputElement[];
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    expect(radios.every((r) => r.tabIndex !== -1)).toBe(true);
  });
});

describe('SPEC-SET-05, PRD-F-11.3: consent list', () => {
  it('SPEC-SET-05: empty list shows the explanation and no Revoke button', async () => {
    mount();
    expect(
      await screen.findByText('No project can use the cloud. Each project asks before its first cloud request.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Revoke/ })).toBeNull();
  });

  it('SPEC-SET-05: lists only consented projects with date and usage, and a long name does not break', async () => {
    const long = 'Harbourline pricing page, 2026 redesign for the spring launch (long name)';
    mount({
      projects: [consented('a', 'Sample landing page', 1, 1024), consented('b', long), project('c', 'No consent here')],
    });
    const list = await screen.findByRole('list', { name: 'Projects allowed to use the cloud' });
    const items = within(list).getAllByRole('listitem');
    expect(items.length).toBe(2);
    expect(items[0]?.textContent).toContain('Sample landing page');
    expect(items[0]?.textContent).toContain('Allowed 25 Nov 2026 · 1 request so far');
    expect(items[1]?.textContent).toContain(long);
    expect(items[1]?.textContent).toContain('Allowed 25 Nov 2026 · no requests yet');
    expect(screen.queryByText('No consent here')).toBeNull();
  });

  it('SPEC-SET-05: Revoke calls onRevoke, removes the row, announces it and keeps focus in the list', async () => {
    const { onRevoke } = mount({ projects: [consented('a', 'One'), consented('b', 'Two')] });
    const buttons = await screen.findAllByRole('button', { name: /^Revoke/ });
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Revoke cloud for One');
    fireEvent.click(buttons[0] as HTMLElement);
    await waitFor(() => expect(onRevoke).toHaveBeenCalledWith('a'));
    await screen.findByText('Revoked cloud for One');
    expect(screen.queryByText('One', { selector: 'div' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Revoke cloud for Two' }));
  });

  it('SPEC-SET-05: revoking the last row shows the empty explanation and moves focus to it', async () => {
    mount({ projects: [consented('a', 'One')] });
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke cloud for One' }));
    const empty = await screen.findByText(
      'No project can use the cloud. Each project asks before its first cloud request.',
    );
    await waitFor(() => expect(document.activeElement).toBe(empty));
  });

  it('SPEC-SET-05: a failed revoke keeps the row and reports it', async () => {
    const onRevoke = vi.fn(async () => {
      throw new Error('x');
    });
    mount({ projects: [consented('a', 'One')], onRevoke });
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke cloud for One' }));
    await screen.findByText('Couldn’t revoke cloud for One. Nothing changed.');
    expect(screen.getByRole('button', { name: 'Revoke cloud for One' })).toBeTruthy();
  });
});

describe('SPEC-SET-06, PRD-F-11.5: privacy section', () => {
  it('SPEC-SET-06: nothing sent shows the idle text and the on-device detail', async () => {
    mount();
    expect(await screen.findByText('Nothing has left this device', { selector: '#priv-text' })).toBeTruthy();
    expect(screen.getByText(/stored only in this browser\. Measured checks never leave it\./)).toBeTruthy();
  });

  it('SPEC-SET-06: after a cloud send it totals requests and KB across projects', async () => {
    mount({
      settings: fakeSettings({ everSent: true }),
      projects: [consented('a', 'A', 1, 412 * 1024), consented('b', 'B', 2, 2048)],
    });
    expect(await screen.findByText('Cloud: 3 requests · 414 KB', { selector: '#priv-text' })).toBeTruthy();
  });

  it('SPEC-SET-06: everSentToCloud with every project deleted still reads as sent, never as idle', async () => {
    mount({ settings: fakeSettings({ everSent: true }), projects: [] });
    expect(
      await screen.findByText('Cloud was used. Open a project to see its totals.', { selector: '#priv-text' }),
    ).toBeTruthy();
  });
});

describe('SPEC-SET-07, PRD-F-11.4: clear all data', () => {
  const open = async () => {
    const trigger = await screen.findByRole('button', { name: 'Clear all data' });
    trigger.focus();
    fireEvent.click(trigger);
    return screen.getByRole('dialog', { name: 'Clear all data?' });
  };

  it('SPEC-SET-07: the data section summarises what is stored and opens a confirm sheet', async () => {
    mount({ usage: { projects: 2, images: 6, contracts: 1, runs: 2, bytes: 14.2 * 1024 * 1024 } });
    expect(
      await screen.findByText('2 projects, 6 images, 1 contract and 2 runs use 14.2 MB on this device.'),
    ).toBeTruthy();
    const dlg = await open();
    expect(dlg.textContent).toContain('2 projects, 6 images, 1 contract, 2 runs (14.2 MB)');
    expect(dlg.textContent).toContain('Mode and the welcome screen reset.');
    expect(dlg.textContent).toContain('Today’s Deep Analysis count');
  });

  it('SPEC-SET-07: without a usage summary the sheet names the classes of data', async () => {
    mount();
    const dlg = await open();
    expect(dlg.textContent).toContain('All projects, images, contracts and runs on this device');
  });

  it('SPEC-UI-06: Cancel has the default focus; Esc and Cancel clear nothing', async () => {
    const { settings } = mount();
    const dlg = await open();
    expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(dlg, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(settings.clearAllData).not.toHaveBeenCalled();
    const trigger = screen.getByRole('button', { name: 'Clear all data' });
    expect(document.activeElement).toBe(trigger);
  });

  it('SPEC-SET-07: the destructive button is aria-disabled until the box is ticked, and a click on it does nothing', async () => {
    const { settings } = mount();
    const dlg = await open();
    const go = within(dlg).getByRole('button', { name: 'Clear all data' });
    expect(go.getAttribute('aria-disabled')).toBe('true');
    expect(within(dlg).getByText('Tick the box to turn this on.')).toBeTruthy();
    fireEvent.click(go);
    expect(settings.clearAllData).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(within(dlg).getByRole('checkbox'));
    fireEvent.click(within(dlg).getByRole('checkbox'));
    expect(go.getAttribute('aria-disabled')).toBeNull();
    expect(within(dlg).queryByText('Tick the box to turn this on.')).toBeNull();
  });

  it('SPEC-SET-07: confirming clears, closes, notifies and announces that the Deep count is kept', async () => {
    const onCleared = vi.fn();
    const { settings } = mount({ onCleared });
    const dlg = await open();
    fireEvent.click(within(dlg).getByRole('checkbox'));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Clear all data' }));
    await waitFor(() => expect(settings.clearAllData).toHaveBeenCalledTimes(1));
    await screen.findByText('All data cleared. Deep Analysis count kept.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it('SPEC-SET-07: a failed clear keeps the sheet open and shows an alert', async () => {
    const settings = fakeSettings();
    settings.clearAllData.mockRejectedValue(new Error('x'));
    mount({ settings });
    const dlg = await open();
    fireEvent.click(within(dlg).getByRole('checkbox'));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Clear all data' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t clear the data');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('SPEC-SET-07: reopening the sheet starts unticked', async () => {
    mount();
    let dlg = await open();
    fireEvent.click(within(dlg).getByRole('checkbox'));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cancel' }));
    dlg = await open();
    expect((within(dlg).getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });
});

describe('S10: theme and about', () => {
  it('S10: Theme select applies data-theme and system removes it', async () => {
    mount();
    const sel = (await screen.findByLabelText('Theme')) as HTMLSelectElement;
    expect(Array.from(sel.options).map((o) => o.text)).toEqual(['System', 'Light', 'Dark']);
    fireEvent.change(sel, { target: { value: 'dark' } });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    fireEvent.change(sel, { target: { value: 'system' } });
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('SPEC-SET-11: About shows version and licence', async () => {
    mount();
    expect(await screen.findByText('Apache-2.0')).toBeTruthy();
    expect(screen.getByText('Version').nextElementSibling?.textContent).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('SPEC-SET-08, PRD-F-12.2: OnboardingScreen', () => {
  const privacy = {
    stored: 'Stored text.',
    sent: 'Sent text.',
    domSnippet: 'Snippet text.',
    appCheck: 'App Check text.',
    analytics: 'None.',
  };
  const setup = (o: Parameters<typeof fakeSettings>[0] = {}) => {
    const settings = fakeSettings(o);
    const onTrySample = vi.fn();
    const onStartProject = vi.fn();
    render(
      <OnboardingScreen
        settings={settings}
        privacy={privacy}
        onTrySample={onTrySample}
        onStartProject={onStartProject}
      />,
    );
    return { settings, onTrySample, onStartProject };
  };

  it('SPEC-SET-08, SPEC-UI-06: one h1, the four-step loop, three engines and the privacy table', async () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Check a page against its design');
    const loop = screen.getByRole('list', { name: 'The loop' });
    expect(
      within(loop)
        .getAllByRole('listitem')
        .map((li) => li.querySelector('.hd')?.textContent),
    ).toEqual(['1.Contract', '2.Run', '3.Fix prompt', '4.Re-verify']);
    expect(screen.getByLabelText('Produced by on-device model')).toBeTruthy();
    expect(screen.getByLabelText('Produced by cloud model')).toBeTruthy();
    expect(screen.getByLabelText('Produced by measurement')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Privacy statement' });
    expect(within(table).getAllByRole('row').length).toBe(6);
    for (const t of Object.values(privacy)) expect(table.textContent).toContain(t);
    expect(within(table).getByRole('rowheader', { name: 'DOM snippet' })).toBeTruthy();
  });

  it('SPEC-SET-08: Try the sample and Start a project mark onboarding done then navigate', async () => {
    const { settings, onTrySample, onStartProject } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Try the sample/ }));
    await waitFor(() => expect(onTrySample).toHaveBeenCalledTimes(1));
    expect(settings.markOnboarded).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Start a project' }));
    await waitFor(() => expect(onStartProject).toHaveBeenCalledTimes(1));
  });

  it('SPEC-SET-08: navigation still happens when marking onboarding fails', async () => {
    const settings = fakeSettings();
    settings.markOnboarded.mockRejectedValue(new Error('x'));
    const onTrySample = vi.fn();
    render(
      <OnboardingScreen settings={settings} privacy={privacy} onTrySample={onTrySample} onStartProject={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Try the sample/ }));
    await waitFor(() => expect(onTrySample).toHaveBeenCalledTimes(1));
  });

  it('SPEC-SET-08: the download offer is hidden unless canDownload', async () => {
    setup();
    await waitFor(() => expect(screen.queryByRole('button', { name: /Download on-device model/ })).toBeNull());
  });

  it('SPEC-SET-08, SPEC-SET-03: the download offer shows progress and then the ready message', async () => {
    let report: (p: number) => void = () => {};
    let finish: () => void = () => {};
    const settings = fakeSettings({ view: { device: 'downloadable', canDownload: true } });
    settings.downloadModel.mockImplementation(
      (cb) =>
        new Promise((res) => {
          report = cb;
          finish = () => res(settingsView());
        }),
    );
    render(<OnboardingScreen settings={settings} privacy={privacy} onTrySample={vi.fn()} onStartProject={vi.fn()} />);
    const btn = await screen.findByRole('button', { name: 'Download on-device model (about 2 GB, once)' });
    fireEvent.click(btn);
    const bar = await screen.findByRole('progressbar', { name: 'On-device model download' });
    act(() => report(0.49));
    expect(bar.getAttribute('aria-valuenow')).toBe('49');
    expect(screen.getByRole('button', { name: 'Downloading 49%' }).getAttribute('aria-busy')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Downloading 49%' }));
    expect(settings.downloadModel).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(await screen.findByText('On-device model ready. The first pass stays on this device.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Downloaded' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('SPEC-SET-03: a failed onboarding download shows an alert and can be retried', async () => {
    const settings = fakeSettings({ view: { device: 'downloadable', canDownload: true } });
    settings.downloadModel.mockRejectedValueOnce(new Error('x'));
    render(<OnboardingScreen settings={settings} privacy={privacy} onTrySample={vi.fn()} onStartProject={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Download on-device model/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t download the model');
    fireEvent.click(screen.getByRole('button', { name: /Download on-device model/ }));
    await waitFor(() => expect(settings.downloadModel).toHaveBeenCalledTimes(2));
  });

  it('SPEC-SET-08: footer links point to Settings and Snippet', async () => {
    setup();
    expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('/settings');
    expect(screen.getByRole('link', { name: 'Snippet' }).getAttribute('href')).toBe('/snippet');
  });
});
