import { StateNotice } from '@projects';
import type { FC } from 'react';
import { useNavigate } from 'react-router';
import { stateCopy } from './copy';

/** SPEC §4.13.2 `*`, also shown for a project or run id that does not exist on this device. */
export const NotFound: FC = () => {
  const navigate = useNavigate();
  return (
    <main id="main" tabIndex={-1} className="page">
      <StateNotice notice={stateCopy.NOT_FOUND} heading onAction={() => navigate('/')} />
    </main>
  );
};
