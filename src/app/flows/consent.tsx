import { type ConsentToken, mintConsent, type Project, type SendList } from '@kernel';
import { ConsentSheet } from '@settings';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { Services } from '../services';

// SPEC-PROJ-07, SPEC-CON-01 step 1, SPEC-RUN-01 step 3: the Project consent sheet. The token is minted from the
// trusted click on Allow (`mintConsent` throws unless `isTrusted`), stored as `{ grantedAt }` through
// `ProjectsService.grantCloudConsent`, and resolved to the waiting flow, which resumes. Decline resolves `null`.

interface Ask {
  sends: SendList;
  reason?: string | undefined;
  resolve(token: ConsentToken | null): void;
}

export interface ConsentPrompt {
  /** Opens the sheet; resolves with the token on Allow, `null` on Decline, Esc or leaving the screen. */
  request(sends: SendList, reason?: string): Promise<ConsentToken | null>;
  /** Render this once in the screen. */
  sheet: ReactNode;
}

export function useConsentPrompt(
  s: Pick<Services, 'projects' | 'consents'>,
  project: Pick<Project, 'id' | 'name'> | undefined,
): ConsentPrompt {
  const [ask, setAsk] = useState<Ask>();
  const open = useRef<Ask | undefined>(undefined);
  open.current = ask;

  // Leaving the screen with the sheet open counts as Decline.
  useEffect(() => () => open.current?.resolve(null), []);

  const request = useCallback(
    (sends: SendList, reason?: string) =>
      new Promise<ConsentToken | null>((resolve) => {
        open.current?.resolve(null);
        setAsk({ sends, reason, resolve });
      }),
    [],
  );

  const sheet =
    ask && project ? (
      <ConsentSheet
        sends={ask.sends}
        projectName={project.name}
        {...(ask.reason && { reason: ask.reason })}
        onDecline={() => {
          setAsk(undefined);
          ask.resolve(null);
        }}
        onAllow={(ev) => {
          void (async () => {
            try {
              const token = mintConsent({ scope: 'project', projectId: project.id }, ev);
              await s.projects.grantCloudConsent(project.id, token);
              s.consents.set(project.id, token);
              setAsk(undefined);
              ask.resolve(token);
            } catch {
              // An untrusted click or a storage error: nothing is granted and nothing is sent.
              setAsk(undefined);
              ask.resolve(null);
            }
          })();
        }}
      />
    ) : null;

  return { request, sheet };
}
