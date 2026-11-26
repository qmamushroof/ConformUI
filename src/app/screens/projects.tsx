import { ProjectsScreen } from '@projects';
import type { FC } from 'react';
import { useNavigate } from 'react-router';
import { useServices } from '../services';

/** `/` (SPEC-PROJ-*). "Try the sample" opens `/?sample=1`; the sample flow itself is wired in 7.3. */
const ProjectsRoute: FC = () => {
  const { projects } = useServices();
  const navigate = useNavigate();
  return <ProjectsScreen service={projects} onOpen={(id) => navigate(`/p/${id}`)} sampleHref="/?sample=1" />;
};
export default ProjectsRoute;
