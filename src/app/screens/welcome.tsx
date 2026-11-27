import { OnboardingScreen } from '@settings';
import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { copy } from '../copy';
import { useServices } from '../services';

// `/welcome` (SPEC-SET-08). Try the sample opens the sample Project (SPEC-DEMO-02): two clicks to Findings.
const WelcomeRoute: FC = () => {
  const { settings, sample } = useServices();
  const [count, setCount] = useState<number>();
  useEffect(() => {
    let live = true;
    void sample().then(
      (a) => live && setCount(a.contract.requirements.length),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [sample]);
  const navigate = useNavigate();
  return (
    <OnboardingScreen
      settings={settings}
      {...(count !== undefined && { sampleRequirements: count })}
      privacy={copy.privacy}
      onTrySample={() => navigate('/?sample=1')}
      onStartProject={() => navigate('/')}
    />
  );
};
export default WelcomeRoute;
