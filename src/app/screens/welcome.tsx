import { OnboardingScreen } from '@settings';
import type { FC } from 'react';
import { useNavigate } from 'react-router';
import { copy } from '../copy';
import { useServices } from '../services';

// `/welcome` (SPEC-SET-08). Try the sample opens the sample Project (SPEC-DEMO-02): two clicks to Findings.
const WelcomeRoute: FC = () => {
  const { settings } = useServices();
  const navigate = useNavigate();
  return (
    <OnboardingScreen
      settings={settings}
      privacy={copy.privacy}
      onTrySample={() => navigate('/?sample=1')}
      onStartProject={() => navigate('/')}
    />
  );
};
export default WelcomeRoute;
