import type { EngineStatus } from '@kernel';
import { ConsentSheet, EngineBadge, EnginePanel, PrivacyCounter } from '@settings';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const status = (o: Partial<EngineStatus> = {}): EngineStatus => ({
  device: 'available',
  deviceImage: true,
  online: true,
  cloud: 'enabled',
  ...o,
});

describe('SPEC-SET-09, PRD-M-04, SPEC-UI-04: EngineBadge', () => {
  it.each([
    ['on-device', 'On-device', 'Produced by on-device model'],
    ['cloud', 'Cloud', 'Produced by cloud model'],
    ['measured', 'Measured', 'Produced by measurement'],
  ] as const)('SPEC-SET-09: %s shows the text label, an icon and the aria-label', (engine, text, aria) => {
    render(<EngineBadge engine={engine} />);
    const b = screen.getByLabelText(aria);
    expect(b.textContent).toBe(text);
    expect(b.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(b.className).toContain('eng');
  });

  it('SPEC-UI-04: each engine has a distinct icon (never colour alone)', () => {
    const paths = (['on-device', 'cloud', 'measured'] as const).map((engine) => {
      const { container, unmount } = render(<EngineBadge engine={engine} />);
      const d = container.querySelector('svg')?.innerHTML ?? '';
      unmount();
      return d;
    });
    expect(new Set(paths).size).toBe(3);
  });

  it.each([
    ['rule', 'measured', 'Rule (Measured)'],
    ['precomputed', 'cloud', 'Pre-computed'],
    ['sample', 'measured', 'Sample (verified)'],
    ['user', 'measured', 'Added by you'],
  ] as const)('SPEC-SET-09: origin %s overrides the engine label with "%s"', (origin, engine, text) => {
    render(<EngineBadge engine={engine} origin={origin} />);
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText(engine === 'cloud' ? 'Cloud' : 'Measured')).toBeNull();
  });

  it('SPEC-SET-09: origin ai keeps the engine label', () => {
    render(<EngineBadge engine="cloud" origin="ai" />);
    expect(screen.getByLabelText('Produced by cloud model').textContent).toBe('Cloud');
  });

  it('SPEC-SET-09: a non-engine origin still has an aria-label', () => {
    render(<EngineBadge engine="measured" origin="user" />);
    expect(screen.getByLabelText('Added by you')).toBeTruthy();
  });
});

describe('SPEC-SET-06, PRD-F-11.5: PrivacyCounter', () => {
  it('SPEC-SET-06: zero requests shows "Nothing has left this device"', () => {
    render(<PrivacyCounter requests={0} bytes={0} />);
    expect(screen.getByText('Nothing has left this device')).toBeTruthy();
  });

  it('SPEC-SET-06: one request is singular with KB to one decimal', () => {
    render(<PrivacyCounter requests={1} bytes={412 * 1024} />);
    expect(screen.getByText('Cloud: 1 request · 412 KB')).toBeTruthy();
  });

  it('SPEC-SET-06: many requests are plural', () => {
    render(<PrivacyCounter requests={3} bytes={1536} />);
    expect(screen.getByText('Cloud: 3 requests · 1.5 KB')).toBeTruthy();
  });

  it('SPEC-SET-06: project scope appends "this project" and has its own idle text', () => {
    const { unmount } = render(<PrivacyCounter requests={2} bytes={2048} scope="project" />);
    expect(screen.getByText('Cloud: 2 requests · 2 KB this project')).toBeTruthy();
    unmount();
    render(<PrivacyCounter requests={0} bytes={0} scope="project" />);
    expect(screen.getByText('Nothing from this project has left this device')).toBeTruthy();
  });

  it('SPEC-SET-06: tiny byte counts never show 0 KB', () => {
    render(<PrivacyCounter requests={1} bytes={3} />);
    expect(screen.getByText('Cloud: 1 request · 0.1 KB')).toBeTruthy();
  });

  it('SPEC-SET-06, SPEC-UI-06: has an aria-label and renders a link when href is given', () => {
    render(<PrivacyCounter requests={0} bytes={0} href="/projects/p/run" />);
    const link = screen.getByRole('link', { name: 'Privacy: Nothing has left this device' });
    expect(link.getAttribute('href')).toBe('/projects/p/run');
  });
});

describe('SPEC-SET-01, PRD-H-06: EnginePanel states', () => {
  it('SPEC-SET-01: available with image on', () => {
    render(<EnginePanel status={status()} mode="auto" onDownload={vi.fn()} />);
    expect(screen.getByText('On-device model ready. First pass stays on this device.')).toBeTruthy();
    expect(screen.getByText('Image input').nextElementSibling?.textContent).toBe('On');
    expect(screen.queryByRole('button', { name: /Download model/ })).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('SPEC-SET-01: available with image off and unknown', () => {
    const { unmount } = render(
      <EnginePanel status={status({ deviceImage: false })} mode="auto" onDownload={vi.fn()} />,
    );
    expect(screen.getByText('Image input').nextElementSibling?.textContent).toBe('Off');
    unmount();
    render(<EnginePanel status={status({ deviceImage: 'unknown' })} mode="auto" onDownload={vi.fn()} />);
    expect(screen.getByText('Image input').nextElementSibling?.textContent).toBe('Not checked');
  });

  it('SPEC-SET-03: downloadable shows Download model, which calls onDownload once per click', () => {
    const onDownload = vi.fn();
    render(<EnginePanel status={status({ device: 'downloadable' })} mode="auto" onDownload={onDownload} />);
    expect(screen.getByText('On-device model not downloaded')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Download model' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Nothing starts until you press the button/)).toBeTruthy();
  });

  it.each([
    [0, 0],
    [0.42, 42],
    [1, 100],
    [1.7, 100],
    [-1, 0],
    [Number.NaN, 0],
    [undefined, 0],
  ])('SPEC-SET-01: downloading at %s has a progressbar with value %s', (p, now) => {
    render(
      <EnginePanel status={status({ device: 'downloading', downloadProgress: p })} mode="auto" onDownload={vi.fn()} />,
    );
    const bar = screen.getByRole('progressbar', { name: 'Model download' });
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuenow')).toBe(String(now));
    expect(screen.getAllByText(`Downloading ${now}%`).length).toBeGreaterThan(0);
    expect(screen.getByText(/You can use the cloud meanwhile, with your consent/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download model' })).toBeNull();
  });

  it('SPEC-SET-03: the long plateau near the end explains that Chrome is still finishing', () => {
    const { rerender } = render(
      <EnginePanel
        status={status({ device: 'downloading', downloadProgress: 0.5 })}
        mode="auto"
        onDownload={vi.fn()}
      />,
    );
    expect(screen.queryByText(/still finishing/)).toBeNull();
    rerender(
      <EnginePanel
        status={status({ device: 'downloading', downloadProgress: 0.93 })}
        mode="auto"
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByText(/still finishing/)).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('93');
  });

  it('SPEC-SET-03: a failed download shows an alert and keeps the Download button usable', () => {
    const onDownload = vi.fn();
    render(
      <EnginePanel
        status={status({ device: 'downloadable' })}
        mode="auto"
        onDownload={onDownload}
        error="Couldn’t download the model."
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Couldn’t download the model.');
    fireEvent.click(screen.getByRole('button', { name: 'Download model' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'not-desktop-chrome',
      'On-device AI needs desktop Chrome. ConformUI uses the cloud here, after you allow it per project.',
    ],
    ['chrome-too-old', 'Update Chrome to 139 or later'],
    ['hardware', "Chrome reports this device can't run the model"],
    ['unknown', 'On-device AI is not available here'],
  ] as const)('SPEC-SET-01: unavailable (%s) shows its headline and no enable steps', (reason, headline) => {
    render(
      <EnginePanel
        status={status({ device: 'unavailable', reason, deviceImage: false })}
        mode="auto"
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByText(headline)).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it.each(['no-prompt-api', 'image-flag-off'] as const)(
    'SPEC-SET-02: unavailable (%s) lists both flags, each with a Copy button that copies the address',
    async (reason) => {
      const writeText = vi.fn(async () => {});
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
      render(<EnginePanel status={status({ device: 'unavailable', reason })} mode="auto" onDownload={vi.fn()} />);
      const steps = screen.getByRole('list');
      expect(within(steps).getAllByRole('listitem').length).toBe(5);
      expect(steps.textContent).toContain('chrome://flags/#prompt-api-multimodal-input');
      expect(steps.textContent).toContain('chrome://flags/#gemma4-for-built-in-ai');
      const copies = screen.getAllByRole('button', { name: 'Copy flag address' });
      expect(copies.length).toBe(2);
      await act(async () => {
        fireEvent.click(copies[1] as HTMLElement);
      });
      expect(writeText).toHaveBeenLastCalledWith('chrome://flags/#gemma4-for-built-in-ai');
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
      });
      expect(writeText).toHaveBeenLastCalledWith('Enabled');
      expect(screen.getByRole('status').textContent).toContain('Copied');
    },
  );

  it('SPEC-SET-02: a clipboard failure is reported, not thrown', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(async () => {
          throw new Error('denied');
        }),
      },
    });
    render(
      <EnginePanel
        status={status({ device: 'unavailable', reason: 'no-prompt-api' })}
        mode="auto"
        onDownload={vi.fn()}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Copy flag address' })[0] as HTMLElement);
    });
    expect(screen.getByRole('status').textContent).toContain('Couldn’t copy');
  });

  it.each([
    [{ online: true, cloud: 'enabled' as const }, 'Reachable'],
    [
      { online: false, cloud: 'enabled' as const },
      'Offline. Cloud steps wait for a connection; your results are kept.',
    ],
    [{ online: true, cloud: 'disabled' as const }, 'Paused'],
  ])('SPEC-SET-01: Cloud row for %j reads "%s"', (o, text) => {
    render(<EnginePanel status={status(o)} mode="auto" onDownload={vi.fn()} />);
    expect(screen.getByText('Cloud').nextElementSibling?.textContent).toBe(text);
  });

  it.each([
    ['auto', 'Auto'],
    ['cloud-only', 'Cloud only'],
    ['on-device-only', 'On-device only'],
  ] as const)('SPEC-SET-01: Mode row shows %s as %s', (mode, label) => {
    render(<EnginePanel status={status()} mode={mode} onDownload={vi.fn()} />);
    expect(screen.getByText('Mode').nextElementSibling?.textContent).toBe(label);
  });

  it('SPEC-UI-04: the headline has an icon and is not colour only', () => {
    render(<EnginePanel status={status()} mode="auto" onDownload={vi.fn()} />);
    expect(document.querySelector('.headline svg[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('PRD-H-05, SPEC-UI-06: ConsentSheet', () => {
  const sends = {
    images: [
      { label: 'Design, Desktop, band 1', bytes: 96 * 1024 },
      { label: 'Design, Desktop, band 2', bytes: 22 * 1024 },
    ],
    text: ['Instructions for the model'],
  };

  it('PRD-H-05: is a labelled modal dialog listing every item and a total', () => {
    render(<ConsentSheet sends={sends} onAllow={vi.fn()} onDecline={vi.fn()} projectName="Sample landing page" />);
    const dlg = screen.getByRole('dialog', { name: 'Allow cloud for this project?' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(within(dlg).getByText('Design, Desktop, band 1')).toBeTruthy();
    expect(within(dlg).getByText('96 KB')).toBeTruthy();
    expect(within(dlg).getByText('Instructions for the model')).toBeTruthy();
    expect(within(dlg).getByText('Total')).toBeTruthy();
    expect(dlg.textContent).toContain('Applies to Sample landing page only.');
  });

  it('PRD-H-05: an empty send list still renders a total and can be declined', () => {
    const onDecline = vi.fn();
    render(<ConsentSheet sends={{ images: [], text: [] }} onAllow={vi.fn()} onDecline={onDecline} />);
    expect(screen.getByText('0 KB')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('SPEC-UI-06: Decline has the default focus', () => {
    render(<ConsentSheet sends={sends} onAllow={vi.fn()} onDecline={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Decline' }));
  });

  it('SPEC-DEEP-01, PRD-H-05: Allow passes the click event up (a synthetic click is not trusted)', () => {
    const onAllow = vi.fn();
    render(<ConsentSheet sends={sends} onAllow={onAllow} onDecline={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Allow for this project/ }));
    expect(onAllow).toHaveBeenCalledTimes(1);
    const ev = onAllow.mock.calls[0]?.[0] as Event;
    expect(ev.type).toBe('click');
    expect(ev.isTrusted).toBe(false);
  });

  it('SPEC-UI-06: Esc declines and does not allow', () => {
    const onAllow = vi.fn();
    const onDecline = vi.fn();
    render(<ConsentSheet sends={sends} onAllow={onAllow} onDecline={onDecline} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onAllow).not.toHaveBeenCalled();
  });

  it('SPEC-UI-06: the Close button declines', () => {
    const onDecline = vi.fn();
    render(<ConsentSheet sends={sends} onAllow={vi.fn()} onDecline={onDecline} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('SPEC-UI-06: Tab and Shift+Tab wrap inside the sheet (focus trap)', () => {
    render(<ConsentSheet sends={sends} onAllow={vi.fn()} onDecline={vi.fn()} />);
    const buttons = within(screen.getByRole('dialog')).getAllByRole('button');
    const first = buttons[0] as HTMLElement;
    const last = buttons[buttons.length - 1] as HTMLElement;
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('SPEC-UI-06: focus returns to the trigger when the sheet closes', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const { unmount } = render(<ConsentSheet sends={sends} onAllow={vi.fn()} onDecline={vi.fn()} />);
    expect(document.activeElement).not.toBe(trigger);
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
