import type { EngineStatus } from '@kernel';
import { describe, expect, it } from 'vitest';
import { engineTexts } from '../../../src/features/settings/engine-text';

// Strings are copied from design/prototype/settings.html (AGENTS.md: UI exactly like the prototype).
const s = (o: Partial<EngineStatus> = {}): EngineStatus => ({
  device: 'available',
  deviceImage: true,
  online: true,
  cloud: 'enabled',
  ...o,
});

describe('SPEC-SET-01: engine text matches the prototype', () => {
  it('SPEC-SET-01: ready', () => {
    const t = engineTexts(s());
    expect(t.headline).toBe('On-device model ready: first pass stays on this device');
    expect(t.detail).toBe(
      'Gemini Nano 4 (Gemma 4) in Chrome on this computer. Contract extraction and judged checks run here unless you choose otherwise.',
    );
    expect(t.enableSteps).toBeUndefined();
  });

  it('SPEC-SET-01: ready with image state unknown keeps the ready text', () => {
    expect(engineTexts(s({ deviceImage: 'unknown' })).headline).toBe(
      'On-device model ready: first pass stays on this device',
    );
  });

  it('SPEC-SET-01: downloadable', () => {
    const t = engineTexts(s({ device: 'downloadable' }));
    expect(t.headline).toBe('On-device model not downloaded');
    expect(t.detail).toBe('Chrome can run Gemini Nano 4 (Gemma 4) on this computer once the model is downloaded.');
    expect(t.canDownload).toBe(true);
  });

  it('SPEC-SET-01: downloading', () => {
    const t = engineTexts(s({ device: 'downloading', downloadProgress: 0.42 }));
    expect(t.headline).toBe('Downloading 42%');
    expect(t.detail).toBe(
      'Chrome is downloading Gemini Nano 4 (Gemma 4). You can keep working; the download continues in the background.',
    );
  });

  it.each([
    ['no-prompt-api', { device: 'unavailable' }],
    ['image-flag-off', { device: 'unavailable' }],
    [undefined, { device: 'available', deviceImage: false }],
  ] as const)('SPEC-SET-01: flag state (%s) says image input is off', (reason, o) => {
    const t = engineTexts(s({ ...o, reason }));
    expect(t.headline).toBe('On-device image input is off');
    expect(t.detail).toBe(
      'Chrome has the model, but image input is turned off, so it can’t read designs yet. Text-only steps still run here.',
    );
    expect(t.canDownload).toBe(false);
  });

  it('SPEC-SET-01: not desktop Chrome', () => {
    const t = engineTexts(s({ device: 'unavailable', reason: 'not-desktop-chrome' }));
    expect(t.headline).toBe(
      'On-device AI needs desktop Chrome. ConformUI uses the cloud here, after you allow it per project.',
    );
    expect(t.detail).toBe('This browser has no on-device model. Measured and Visual checks still run on this device.');
  });
});

describe('SPEC-SET-02: four enable steps, as in the prototype, naming both flags', () => {
  it('SPEC-SET-02: has four steps in the prototype order', () => {
    const steps = engineTexts(s({ device: 'unavailable', reason: 'image-flag-off' })).enableSteps ?? [];
    expect(steps).toHaveLength(4);
    expect(steps[0]).toBe(
      'Open chrome://flags/#prompt-api-multimodal-input and chrome://flags/#gemma4-for-built-in-ai',
    );
    expect(steps[1]).toBe('Set both to Enabled');
    expect(steps[2]).toBe('Relaunch Chrome');
    expect(steps[3]).toBe('Come back and press Download model');
  });
});
