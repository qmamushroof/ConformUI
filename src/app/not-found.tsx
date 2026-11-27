import { StateNotice } from '@projects';
import type { FC } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { stateCopy } from './copy';

/** SPEC §4.13.2 `*`, also shown for a project or run id that does not exist on this device. */
export const NotFound: FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Prototype 404: "Nothing is stored at <path>." comes before the explanation.
  const { detail, ...notice } = stateCopy.NOT_FOUND;
  return (
    <main id="main" tabIndex={-1} className="page">
      <div className="state-wrap">
        <StateNotice notice={notice} heading onAction={() => navigate('/')}>
          <p className="small muted">
            Nothing is stored at <span className="mono">{pathname}</span>. {detail}
          </p>
        </StateNotice>
      </div>
    </main>
  );
};
