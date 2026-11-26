import { ProjectsScreen } from '@projects';
import { type FC, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { copy } from '../copy';
import { downloadText, MIME } from '../flows/files';
import { createSampleProject } from '../flows/sample';
import { useServices } from '../services';

/**
 * `/` (SPEC-PROJ-*). "Try the sample" opens `/?sample=1`: the sample Project is built and opened with Run as the
 * primary action (SPEC-DEMO-02), so Findings are two clicks away (PRD-M-13).
 */
const ProjectsRoute: FC = () => {
  const sv = useServices();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const wantSample = params.get('sample') === '1';
  const started = useRef(false);
  const [failure, setFailure] = useState<{ error: unknown }>();

  useEffect(() => {
    if (!wantSample || started.current) return;
    started.current = true;
    createSampleProject(sv)
      .then((p) => navigate(`/p/${p.id}`, { replace: true }))
      .catch((error: unknown) => setFailure({ error }));
  }, [wantSample, sv, navigate]);

  if (failure) throw failure.error;
  if (wantSample) {
    return (
      <main id="main" tabIndex={-1} className="page" aria-busy="true">
        <p role="status" className="muted">
          {copy.flows.sampleBusy}
        </p>
      </main>
    );
  }

  const exportContract = async (projectId: string) => {
    const [project, contract, exp] = await Promise.all([
      sv.projects.get(projectId),
      sv.contract.active(projectId),
      import('@export'),
    ]);
    if (!project || !contract) return;
    downloadText(
      exp.fileName('contract', project, 'md', sv.clock.now()),
      exp.contractMarkdown(contract, project),
      MIME.md,
    );
  };

  return (
    <ProjectsScreen
      service={sv.projects}
      onOpen={(id) => navigate(`/p/${id}`)}
      sampleHref="/?sample=1"
      onExportContract={(id) => void exportContract(id)}
    />
  );
};
export default ProjectsRoute;
