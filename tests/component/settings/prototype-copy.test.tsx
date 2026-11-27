import type { EngineStatus } from '@kernel';
import { EnginePanel } from '@settings';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

// Expected strings are the prototype's (design/prototype/settings.html), AGENTS.md: UI exactly like the prototype.
const st = (o: Partial<EngineStatus> = {}): EngineStatus => ({
  device: 'available',
  deviceImage: true,
  online: true,
  cloud: 'enabled',
  ...o,
});
const panel = (o: Partial<EngineStatus>) => render(<EnginePanel status={st(o)} mode="auto" onDownload={vi.fn()} />);
const image = () => screen.getByText('Image input').nextElementSibling?.textContent;

describe('SPEC-SET-01: engine panel text equals the prototype', () => {
  it('SPEC-SET-01: ready', () => {
    panel({});
    expect(screen.getByText('On-device model ready: first pass stays on this device')).toBeTruthy();
    expect(
      screen.getByText(/^Gemini Nano 4 \(Gemma 4\) in Chrome on this computer\. Contract extraction/),
    ).toBeTruthy();
    expect(image()).toBe('On');
  });

  it('SPEC-SET-01: downloadable shows detail and "On, after download"', () => {
    panel({ device: 'downloadable', deviceImage: 'unknown' });
    expect(
      screen.getByText('Chrome can run Gemini Nano 4 (Gemma 4) on this computer once the model is downloaded.'),
    ).toBeTruthy();
    expect(image()).toBe('On, after download');
  });

  it('SPEC-SET-01: downloading shows the detail line, not only the headline', () => {
    panel({ device: 'downloading', downloadProgress: 0.42, deviceImage: 'unknown' });
    expect(
      screen.getByText(
        'Chrome is downloading Gemini Nano 4 (Gemma 4). You can keep working; the download continues in the background.',
      ),
    ).toBeTruthy();
    expect(image()).toBe('On, after download');
  });

  it('SPEC-SET-01: flag off shows the prototype headline, detail and Off', () => {
    panel({ device: 'unavailable', reason: 'image-flag-off', deviceImage: false });
    expect(screen.getByText('On-device image input is off')).toBeTruthy();
    expect(
      screen.getByText(
        'Chrome has the model, but image input is turned off, so it can’t read designs yet. Text-only steps still run here.',
      ),
    ).toBeTruthy();
    expect(image()).toBe('Off');
  });

  it('SPEC-SET-01: not desktop Chrome shows the prototype detail and Not available', () => {
    panel({ device: 'unavailable', reason: 'not-desktop-chrome', deviceImage: false });
    expect(
      screen.getByText('This browser has no on-device model. Measured and Visual checks still run on this device.'),
    ).toBeTruthy();
    expect(image()).toBe('Not available');
  });
});

describe('SPEC-SET-02: the enable steps follow the prototype (four steps, Gemma 4 flag added to steps 1 and 2)', () => {
  it('SPEC-SET-02: four steps, step 1 offers both flag addresses with copy buttons', () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    panel({ device: 'unavailable', reason: 'image-flag-off', deviceImage: false });
    expect(screen.getByRole('heading', { name: 'Turn on image input in Chrome' })).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(within(items[0] as HTMLElement).getByText('chrome://flags/#prompt-api-multimodal-input')).toBeTruthy();
    expect(within(items[0] as HTMLElement).getByText('chrome://flags/#gemma4-for-built-in-ai')).toBeTruthy();
    expect(items[1]?.textContent).toBe('Set both to Enabled.Copy');
    expect(items[2]?.textContent).toBe('Relaunch Chrome.');
    expect(items[3]?.textContent).toBe('Come back here and press Download model.');
    const copies = within(items[0] as HTMLElement).getAllByRole('button');
    expect(copies).toHaveLength(2);
    fireEvent.click(copies[1] as HTMLElement);
    expect(writeText).toHaveBeenCalledWith('chrome://flags/#gemma4-for-built-in-ai');
  });
});
