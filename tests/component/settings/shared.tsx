import type { EngineView, SettingsService } from '@settings';
import { vi } from 'vitest';

export const view = (o: Partial<EngineView> = {}): EngineView => ({
  device: 'available',
  headline: 'On-device model ready. First pass stays on this device.',
  detail: 'Image input: on',
  canDownload: false,
  imageOnDevice: true,
  online: true,
  cloud: 'enabled',
  mode: 'auto',
  ...o,
});

export function fakeSettings(o: { view?: Partial<EngineView>; everSent?: boolean; mode?: EngineView['mode'] } = {}) {
  const s = {
    read: vi.fn(async () => ({
      mode: o.mode ?? ('auto' as const),
      onboarded: false,
      deepUsage: { day: '2026-11-25', count: 1 },
      everSentToCloud: o.everSent ?? false,
    })),
    setMode: vi.fn(async () => {}),
    markOnboarded: vi.fn(async () => {}),
    engine: vi.fn(async () => view({ mode: o.mode ?? 'auto', ...o.view })),
    downloadModel: vi.fn(async (onProgress: (p: number) => void) => {
      onProgress(0.5);
      return view({ device: 'available' });
    }),
    clearAllData: vi.fn(async () => {}),
    privacy: vi.fn(() => ({ kind: 'nothing-sent' as const, text: 'Nothing has left this device' as const })),
  } satisfies SettingsService;
  return s;
}
