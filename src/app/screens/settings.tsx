import { SettingsScreen } from '@settings';
import { type FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { USAGE_EVENT } from '../hooks';
import { useServices } from '../services';

const localDay = (ms: number): string => new Date(ms).toLocaleDateString('en-CA');

export interface SettingsRouteProps {
  appVersion: string;
  appCommit?: string | undefined;
  repoUrl?: string | undefined;
}

/** `/settings` (SPEC-SET-*): the Settings screen over the settings service and the Project store. */
const SettingsRoute: FC<SettingsRouteProps> = ({ appVersion, appCommit, repoUrl }) => {
  const { settings: service, store, projects, settingsStore, config, clock } = useServices();
  const navigate = useNavigate();
  // The header's engine pill reads the mode and the device status: tell it when either changes here.
  const settings = useMemo(
    () => ({
      ...service,
      setMode: async (m: Parameters<typeof service.setMode>[0]) => {
        await service.setMode(m);
        window.dispatchEvent(new Event(USAGE_EVENT));
      },
      downloadModel: async (onProgress: Parameters<typeof service.downloadModel>[0]) => {
        const view = await service.downloadModel(onProgress);
        window.dispatchEvent(new Event(USAGE_EVENT));
        return view;
      },
    }),
    [service],
  );
  const [deepUsage, setDeepUsage] = useState<{ count: number; cap: number }>();

  useEffect(() => {
    let live = true;
    settingsStore
      .read()
      .then((s) => {
        const today = s.deepUsage.day === localDay(clock.now());
        if (live) setDeepUsage({ count: today ? s.deepUsage.count : 0, cap: config.get().deep_daily_cap });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [settingsStore, config, clock]);

  return (
    <SettingsScreen
      settings={settings}
      loadProjects={() => store.list()}
      onRevoke={async (id) => {
        await projects.revokeCloudConsent(id);
        window.dispatchEvent(new Event(USAGE_EVENT));
      }}
      onCleared={() => {
        window.dispatchEvent(new Event(USAGE_EVENT));
        navigate('/welcome', { replace: true });
      }}
      deepUsage={deepUsage}
      about={{
        version: appVersion,
        licence: 'Apache-2.0',
        ...(appCommit ? { commit: appCommit } : {}),
        ...(repoUrl ? { source: repoUrl } : {}),
      }}
    />
  );
};
export default SettingsRoute;
