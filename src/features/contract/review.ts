import {
  type Contract,
  CuiError,
  MAX_REQUIREMENTS,
  type ManualRequirementDraft,
  ManualRequirementDraftSchema,
  nextContractVersion,
  type Project,
  type Rect,
  type Requirement,
  type ViewportId,
} from '@kernel';
import { inferredFor } from './infer';
import type { ContractDeps } from './types';

// Review, lock and versioning (SPEC-CON-05, SPEC-CON-06) and the sample entry points (SPEC-DEMO-03, SPEC-DEMO-05).

const fail = (message: string): never => {
  throw new CuiError('STORAGE_FAILED', message);
};

const designed = (p: Project): ViewportId[] => p.designs.map((d) => d.viewport);

async function loadProject(d: ContractDeps, id: string): Promise<Project> {
  return (await d.store.get(id)) ?? fail('Project not found');
}

/** Inferred items for a Contract from the Project's design viewports (SPEC-CON-04). */
export function withInferred(c: Contract, p: Project): Contract {
  const added = inferredFor(c.requirements, designed(p));
  return added.length === 0 ? c : { ...c, requirements: [...c.requirements, ...added] };
}

/**
 * One review edit. A locked Contract that is the active one becomes a new unlocked version (SPEC-CON-06);
 * a locked, superseded one cannot be edited: CONTRACT_LOCKED. Nothing is saved when the edit changes nothing.
 */
async function mutate(
  d: ContractDeps,
  contractId: string,
  edit: (reqs: Requirement[]) => Requirement[],
  opts: { infer: boolean },
): Promise<Contract> {
  const c = (await d.store.getContract(contractId)) ?? fail('Contract not found');
  const project = await loadProject(d, c.projectId);
  if (c.locked && project.activeContractId !== c.id) {
    throw new CuiError('CONTRACT_LOCKED', 'This contract version is locked');
  }
  let next: Contract = { ...c, requirements: edit(structuredClone(c.requirements)) };
  if (opts.infer) next = withInferred(next, project);
  if (JSON.stringify(next.requirements) === JSON.stringify(c.requirements)) return c;
  if (!c.locked) {
    await d.store.putContract(next);
    return next;
  }
  const versioned: Contract = { ...nextContractVersion(c, d.ids, d.clock), requirements: next.requirements };
  await d.store.putContract(versioned);
  await d.store.put({ ...project, activeContractId: versioned.id, updatedAt: d.clock.now() });
  return versioned;
}

const find = (reqs: Requirement[], id: string): Requirement =>
  reqs.find((r) => r.id === id) ?? fail(`Requirement ${id} not found`);

export const accept = (d: ContractDeps, contractId: string, reqIds: string[] | 'all') =>
  mutate(
    d,
    contractId,
    (reqs) => {
      if (reqIds !== 'all') for (const id of reqIds) find(reqs, id);
      for (const r of reqs) if (reqIds === 'all' || reqIds.includes(r.id)) r.accepted = true;
      return reqs;
    },
    { infer: true },
  );

export const editText = (
  d: ContractDeps,
  contractId: string,
  reqId: string,
  patch: { statement?: string; condition?: string },
) =>
  mutate(
    d,
    contractId,
    (reqs) => {
      const r = find(reqs, reqId);
      const clean = (v: string, max: number) => v.trim().slice(0, max).trim() || fail('Text cannot be empty');
      if (patch.statement !== undefined) r.statement = clean(patch.statement, 160);
      if (patch.condition !== undefined) r.condition = clean(patch.condition, 200);
      return reqs;
    },
    { infer: false },
  );

export const remove = (d: ContractDeps, contractId: string, reqId: string) =>
  mutate(
    d,
    contractId,
    (reqs) => {
      find(reqs, reqId);
      return reqs.filter((r) => r.id !== reqId);
    },
    { infer: false },
  );

export const setRegion = (d: ContractDeps, contractId: string, reqId: string, rect: Rect) =>
  mutate(
    d,
    contractId,
    (reqs) => {
      find(reqs, reqId).region = { rect, source: 'user' };
      return reqs;
    },
    { infer: false },
  );

export const add = (d: ContractDeps, contractId: string, draft: ManualRequirementDraft) =>
  mutate(
    d,
    contractId,
    (reqs) => {
      const ok = ManualRequirementDraftSchema.safeParse(draft);
      if (!ok.success || !draft.statement.trim() || !draft.condition.trim()) fail('The requirement is not valid');
      if (reqs.length >= MAX_REQUIREMENTS) fail(`A contract holds at most ${MAX_REQUIREMENTS} requirements`);
      const top = Math.max(0, ...reqs.map((r) => Number(/^R-(\d+)$/.exec(r.id)?.[1] ?? 0)));
      const added: Requirement = {
        ...draft,
        statement: draft.statement.trim(),
        condition: draft.condition.trim(),
        id: `R-${String(top + 1).padStart(2, '0')}`,
        label: 'explicit',
        accepted: true,
        origin: 'user',
      };
      return [...reqs, added];
    },
    { infer: true },
  );

/** Sample: the committed Contract becomes the Project's active one (SPEC-DEMO-03). */
export async function loadCommitted(d: ContractDeps, projectId: string, c: Contract): Promise<Contract> {
  const project = await loadProject(d, projectId);
  const stored = withInferred({ ...structuredClone(c), projectId }, project);
  await d.store.putContract(stored);
  await d.store.put({ ...project, activeContractId: stored.id, updatedAt: d.clock.now() });
  return stored;
}

export async function useAiContract(d: ContractDeps, projectId: string): Promise<Contract> {
  const project = await loadProject(d, projectId);
  if (!project.pendingAiContractId) return fail('There is no AI contract to use');
  const c = (await d.store.getContract(project.pendingAiContractId)) ?? fail('The AI contract is missing');
  const { pendingAiContractId: _gone, ...rest } = project;
  await d.store.put({ ...rest, activeContractId: c.id, updatedAt: d.clock.now() });
  return c;
}

/** Sample fallback (SPEC-DEMO-05): kept beside the verified Contract as the pending one. */
export async function loadPrecomputedExtraction(
  d: ContractDeps,
  projectId: string,
  reqs: Requirement[],
): Promise<Contract> {
  const project = await loadProject(d, projectId);
  const active = project.activeContractId ? await d.store.getContract(project.activeContractId) : undefined;
  const base: Contract = {
    id: d.ids.next(),
    projectId,
    version: (active?.version ?? 0) + 1,
    createdAt: d.clock.now(),
    locked: false,
    requirements: reqs.map((r) => ({ ...structuredClone(r), origin: 'precomputed', accepted: false })),
  };
  const c = withInferred(base, project);
  await d.store.putContract(c);
  await d.store.put({ ...project, pendingAiContractId: c.id, updatedAt: d.clock.now() });
  return c;
}
