import type { ConsentToken, Project } from '@kernel';

// SPEC-PROJ-07: a Project consent token can only be minted from a trusted click, and the stored consent is just
// `{ grantedAt }`. This keeps the token minted this session, so the next request does not ask again. It is memory only:
// after a reload the sheet asks once more. Revoking removes `Project.cloudConsent`, which also drops the token here.

export interface ConsentCache {
  /** The session's token, only while the Project still has its stored consent. */
  get(project: Pick<Project, 'id' | 'cloudConsent'>): ConsentToken | undefined;
  set(projectId: string, token: ConsentToken): void;
  clear(projectId?: string): void;
}

export function createConsentCache(): ConsentCache {
  const tokens = new Map<string, ConsentToken>();
  return {
    get(project) {
      if (!project.cloudConsent) {
        tokens.delete(project.id);
        return undefined;
      }
      return tokens.get(project.id);
    },
    set: (projectId, token) => void tokens.set(projectId, token),
    clear: (projectId) => (projectId === undefined ? tokens.clear() : void tokens.delete(projectId)),
  };
}
