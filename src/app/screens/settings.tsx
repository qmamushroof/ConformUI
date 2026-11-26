import { SettingsScreen } from '@settings';
import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { USAGE_EVENT } from '../hooks';
import { useServices } from '../services';

const localDay = (ms: number): string => new Date(ms).toLocaleDateString('en-CA');

export interface SettingsRouteProps {
  appVersion: string;
}

/** `/settings` (SPEC-SET-*): the Settings screen over the settings service and the Project store. */
const SettingsRoute: FC<SettingsRouteProps> = ({ appVersion }) => {
  const { settings, store, projects, settingsStore, config, clock } = useServices();
  const navigate = useNavigate();
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
      about={{ version: appVersion, licence: 'Apache-2.0' }}
    />
  );
};
export default SettingsRoute;
