import type { Project } from '@kernel';
import { copy } from '../copy';
import type { Services } from '../services';

// SPEC-DEMO-02, SPEC-DEMO-04: the sample Project is built from committed assets through the public services. The demo
// module never imports other features, so `app` does the composition.

const VIEWPORTS = ['desktop', 'mobile'] as const;

/** "Try the sample": a new Project with the desktop design, the flawed captures and snapshots, and the verified Contract. */
export async function createSampleProject(s: Services): Promise<Project> {
  const assets = await s.sample();
  const created = await s.projects.create(copy.flows.sampleName);
  // `ProjectsService.create` makes ordinary Projects; the sample flag is set through the store.
  await s.store.put({ ...created, isSample: true });
  try {
    await s.projects.addDesign(created.id, assets.design.desktop, 'desktop');
    for (const vp of VIEWPORTS) {
      const set = assets.flawed[vp];
      await s.projects.addCapture(created.id, set.image, vp, set.dom);
    }
    // A fresh Contract id per copy: clicking the sample twice must not share one Contract between two Projects.
    await s.contract.loadCommitted(created.id, { ...assets.contract, id: s.ids.next() });
  } catch (e) {
    await s.projects.remove(created.id).catch(() => undefined);
    throw e;
  }
  const project = await s.projects.get(created.id);
  if (!project) throw new Error('The sample project was not saved');
  return project;
}

/** "Load fixed implementation": replaces both captures and snapshots with the fixed set (SPEC-DEMO-04). */
export async function loadFixedImplementation(s: Services, projectId: string): Promise<void> {
  const assets = await s.sample();
  for (const vp of VIEWPORTS) {
    const set = assets.fixed[vp];
    await s.projects.addCapture(projectId, set.image, vp, set.dom);
  }
}
