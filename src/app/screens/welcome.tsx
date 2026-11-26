import { OnboardingScreen } from '@settings';
import type { FC } from 'react';
import { useNavigate } from 'react-router';
import { copy } from '../copy';
import { useServices } from '../services';

// `/welcome` (SPEC-SET-08). The sample entry point is wired in 7.3; until then both actions open Projects.
const WelcomeRoute: FC = () => {
  const { settings } = useServices();
  const navigate = useNavigate();
  const home = () => navigate('/');
  return <OnboardingScreen settings={settings} privacy={copy.privacy} onTrySample={home} onStartProject={home} />;
};
export default WelcomeRoute;
