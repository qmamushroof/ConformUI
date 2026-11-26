import type { Project } from '@kernel';
import type { FC } from 'react';
import { Icon } from './icon';

export type ProjectStep = 'design' | 'contract' | 'captures' | 'run' | 'fix' | 'reverify';

const STEPS: { id: ProjectStep; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'contract', label: 'Contract' },
  { id: 'captures', label: 'Captures' },
  { id: 'run', label: 'Run' },
  { id: 'fix', label: 'Fix' },
  { id: 'reverify', label: 'Re-verify' },
];

/** Crumbs and the six-step stepper shown above every project route (SPEC §5.1, SPEC-UI-06). */
export interface ProjectHeadProps {
  project: Pick<Project, 'id' | 'name' | 'isSample'>;
  /** The step of the current route. */
  step: ProjectStep;
  /** How many steps from the start are done. */
  done: number;
  /** The suggested next step. */
  next: ProjectStep;
  /** Label of a deeper crumb, for example "Contract". */
  crumb?: string;
  /** Overrides the link of a step (for example the latest Run). */
  hrefs?: Partial<Record<ProjectStep, string>>;
}

export const ProjectHead: FC<ProjectHeadProps> = ({ project, step, done, next, crumb, hrefs }) => {
  const base = `/p/${project.id}`;
  const href: Record<ProjectStep, string> = {
    design: base,
    contract: `${base}/contract`,
    captures: `${base}#captures`,
    run: base,
    fix: base,
    reverify: base,
    ...hrefs,
  };
  const current = Math.max(
    0,
    STEPS.findIndex((s) => s.id === step),
  );
  return (
    <div className="phead">
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/">Projects</a>
        <span className="sep" aria-hidden="true">
          /
        </span>
        <a href={base}>{project.name}</a>
        {project.isSample ? <span className="tag">Sample</span> : null}
        {crumb ? (
          <>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <span>{crumb}</span>
          </>
        ) : null}
      </nav>
      <ol className="steps" aria-label="Project steps" data-progress={`Step ${current + 1} of ${STEPS.length}:`}>
        {STEPS.map((s, k) => {
          const isDone = k < done;
          const isNext = s.id === next;
          return (
            <li key={s.id} className={`${isDone ? 'done' : ''}${isNext ? ' next' : ''}`.trim()}>
              <a href={href[s.id]} aria-current={s.id === step ? 'step' : undefined}>
                <span className="n" aria-hidden="true">
                  {isDone ? <Icon name="check" /> : k + 1}
                </span>
                <span className="lbl">
                  {s.label}
                  {isNext ? ', next' : ''}
                </span>
                {isDone ? <span className="sr-only"> (done)</span> : null}
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
