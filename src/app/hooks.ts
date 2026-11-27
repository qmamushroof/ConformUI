import type { EngineStatus, Settings } from '@kernel';
import { useEffect, useState } from 'react';
import { copy } from './copy';
import { useServices } from './services';

/** Fired by the cross-feature flows (7.3) after they record cloud usage, so the header counter refreshes. */
export const USAGE_EVENT = 'cui:usage-changed';

export type EnginePill = 'onDevice' | 'cloud' | 'measured';

/** SPEC-APP-02: what the header's Engine pill says, from the live status and the chosen mode. */
export function enginePill(status: EngineStatus, mode: Settings['mode']): EnginePill {
  if (mode !== 'cloud-only' && status.device === 'available' && status.deviceImage !== false) return 'onDevice';
  if (mode !== 'on-device-only' && status.cloud === 'enabled' && status.online) return 'cloud';
  return 'measured';
}

/** Prototype pill states for a device model that is not usable yet (SPEC-APP-02); undefined when the device is ready or absent. */
export function deviceStatePill(status: EngineStatus, mode: Settings['mode']): string | undefined {
  if (mode === 'cloud-only') return undefined;
  if (status.device === 'downloadable') return copy.header.engine.notDownloaded;
  if (status.device === 'downloading') {
    const p = Number.isFinite(status.downloadProgress) ? (status.downloadProgress as number) : 0;
    return copy.header.engine.downloading(Math.round(Math.min(1, Math.max(0, p)) * 100));
  }
  const flagOff =
    status.device === 'available'
      ? status.deviceImage === false
      : status.device === 'unavailable' && (status.reason === 'image-flag-off' || status.reason === 'no-prompt-api');
  return flagOff ? copy.header.engine.deviceOff : undefined;
}

export interface EngineView {
  status: EngineStatus;
  mode: Settings['mode'];
}

/** Engine status, refreshed on online/offline, when the lazy engine resolves and on `USAGE_EVENT` (mode, download). */
export function useEngineView(): EngineView | undefined {
  const { ai, settingsStore, onEngineChange } = useServices();
  const [view, setView] = useState<EngineView>();
  useEffect(() => {
    let live = true;
    const refresh = () => {
      Promise.all([ai.status(), settingsStore.read()])
        .then(([status, s]) => live && setView({ status, mode: s.mode }))
        .catch(() => undefined);
    };
    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener(USAGE_EVENT, refresh); // Settings changed the mode or finished the model download
    const off = onEngineChange(refresh);
    return () => {
      live = false;
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      window.removeEventListener(USAGE_EVENT, refresh);
      off();
    };
  }, [ai, settingsStore, onEngineChange]);
  return view;
}

export interface PrivacyTotals {
  requests: number;
  bytes: number;
}

/**
 * SPEC-SET-06: zero until `everSentToCloud`; then the Project's own usage inside a Project, else the total over all
 * Projects. Refreshed on route change and on `USAGE_EVENT`.
 */
export function usePrivacyTotals(projectId: string | undefined, pathname: string): PrivacyTotals {
  const { store, settingsStore } = useServices();
  const [totals, setTotals] = useState<PrivacyTotals>({ requests: 0, bytes: 0 });
  // biome-ignore lint/correctness/useExhaustiveDependencies: the path re-reads the stores after navigation.
  useEffect(() => {
    let live = true;
    const refresh = async () => {
      try {
        const settings = await settingsStore.read();
        if (!settings.everSentToCloud) return live && setTotals({ requests: 0, bytes: 0 });
        const projects = projectId ? [await store.get(projectId)] : await store.list();
        const sum = projects.reduce(
          (t, p) => ({
            requests: t.requests + (p?.cloudUsage.requests ?? 0),
            bytes: t.bytes + (p?.cloudUsage.bytes ?? 0),
          }),
          { requests: 0, bytes: 0 },
        );
        if (live) setTotals(sum);
      } catch {
        // The counter is informational; a storage error surfaces elsewhere.
      }
    };
    void refresh();
    const on = () => void refresh();
    window.addEventListener(USAGE_EVENT, on);
    return () => {
      live = false;
      window.removeEventListener(USAGE_EVENT, on);
    };
  }, [store, settingsStore, projectId, pathname]);
  return totals;
}

/** Subscribes to a `{ ready/canInstall, subscribe }` style external store. */
export function useExternal(read: () => boolean, subscribe: (l: () => void) => () => void): boolean {
  const [value, setValue] = useState(read);
  useEffect(() => {
    setValue(read());
    return subscribe(() => setValue(read()));
  }, [read, subscribe]);
  return value;
}
