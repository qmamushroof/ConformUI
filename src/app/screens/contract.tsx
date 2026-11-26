import { ContractScreen } from '@contract';
import type { Contract, Project, ViewportId } from '@kernel';
import { type FC, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { stateCopy } from '../copy';
import { NotFound } from '../not-found';
import { useServices } from '../services';

interface Data {
  project: Project;
  contract?: Contract;
  pending?: Contract;
  designSrc: Partial<Record<ViewportId, string>>;
}

type Load = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; data: Data };

/**
 * `/p/:projectId/contract` (SPEC-CON-*): loads the Project, its active and pending Contract and the design images,
 * and passes the review actions of the contract service. Consent for cloud extraction is wired in 7.3.
 */
const ContractRoute: FC = () => {
  const { projectId = '' } = useParams();
  const { projects, contract, store, blobs, settingsStore, ai } = useServices();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [extractError, setExtractError] = useState<{ title: string; detail?: string; code?: string }>();
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads after a service call.
  useEffect(() => {
    let live = true;
    const urls: string[] = [];
    (async () => {
      const project = await projects.get(projectId);
      if (!project) return live && setLoad({ kind: 'missing' });
      const active = await contract.active(projectId);
      const pending = project.pendingAiContractId ? await store.getContract(project.pendingAiContractId) : undefined;
      const designSrc: Partial<Record<ViewportId, string>> = {};
      for (const d of project.designs) {
        const blob = await blobs.get(d.image.blobId);
        if (blob && typeof URL.createObjectURL === 'function') {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          designSrc[d.viewport] = url;
        }
      }
      if (live) setLoad({ kind: 'ready', data: { project, contract: active, pending, designSrc } });
    })().catch(() => live && setLoad({ kind: 'missing' }));
    return () => {
      live = false;
      for (const u of urls) URL.revokeObjectURL?.(u);
    };
  }, [projectId, projects, contract, store, blobs, version]);

  const extract = async () => {
    setExtractError(undefined);
    try {
      const [settings, status] = await Promise.all([settingsStore.read(), ai.status()]);
      const out = await contract.extract(projectId, { settings, status }, () => undefined);
      if (out.kind === 'needs-consent') {
        setExtractError({ title: stateCopy.CONSENT_REQUIRED.title, code: 'CONSENT_REQUIRED' });
      }
    } catch (e) {
      const code = (e as { code?: keyof typeof stateCopy }).code;
      const notice = code && code in stateCopy ? stateCopy[code] : stateCopy.ROUTE_ERROR;
      setExtractError({ title: notice.title, detail: notice.detail, code: code ?? 'ROUTE_ERROR' });
    }
    refresh();
  };

  if (load.kind === 'loading') return <main id="main" tabIndex={-1} className="page" aria-busy="true" />;
  if (load.kind === 'missing') return <NotFound />;
  const { project, contract: active, pending, designSrc } = load.data;
  return (
    <ContractScreen
      project={project}
      contract={active}
      pending={pending}
      designSrc={designSrc}
      service={contract}
      onExtract={() => void extract()}
      extractError={extractError}
      onChange={refresh}
    />
  );
};
export default ContractRoute;
