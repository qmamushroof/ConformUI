import {
  type Capture,
  type ConsentToken,
  type Contract,
  DEFAULT_RUNTIME_VALUES,
  type DesignRef,
  type DomSnapshot,
  type EngineStatus,
  type ImageCodec,
  mintConsent,
  type PrecomputedJudged,
  type Project,
  type Rect,
  type Requirement,
  type RgbaImage,
  type RuntimeConfig,
  type RuntimeValues,
  type Settings,
  type ViewportId,
} from '@kernel';
import { inlineMeasureClient } from '@measure';
import { createFakeAiEngine, type FakeAiConfig, type FakeAiEngine } from '../../../src/app/testing/fake-ai-engine';
import { createRunService, type RunEvent, type RunService } from '../../../src/features/run';
import { fixedClock } from '../../helpers/clock-ids';
import { InMemoryBlobStore, InMemoryProjectStore } from '../../helpers/memory-stores';
import { createNodeImageCodec, pngBlob, solidImage } from '../../helpers/node-codec';
import { domElement, domSnapshot, imageRef, requirement, settings as sampleSettings } from '../../helpers/samples';

// Shared setup for the run service tests (SPEC-RUN-01..13): a 400 x 300 page, in-memory ports, the FakeAiEngine seam.

export const W = 400;
export const H = 300;
export const R: Rect = { x: 100, y: 100, w: 100, h: 50 };
const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const DARK: [number, number, number, number] = [30, 30, 30, 255];

export const page = (...blocks: Rect[]): RgbaImage => {
  const img = solidImage(W, H, WHITE);
  for (const r of blocks) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) img.data.set(DARK, (y * W + x) * 4);
  }
  return img;
};

export const status = (over: Partial<EngineStatus> = {}): EngineStatus => ({
  device: 'available',
  deviceImage: true,
  online: true,
  cloud: 'enabled',
  ...over,
});

export const consent = (projectId = 'project-1'): ConsentToken =>
  mintConsent({ scope: 'project', projectId }, { isTrusted: true });

export const cta = (w: number): DomSnapshot =>
  domSnapshot({
    viewport: { width: W, height: H },
    document: { scrollWidth: W, scrollHeight: H, clientWidth: W },
    elements: [
      domElement({
        i: 0,
        tag: 'a',
        kind: 'link',
        text: 'Start free',
        selector: '#cta',
        box: { x: 100, y: 100, w, h: 50 },
      }),
    ],
  });

/** size R-01 (measured, DOM), judged R-02, on desktop; presence R-03 on mobile; inferred layout I-M-01 on mobile. */
export const requirements = (): Requirement[] => [
  requirement({
    id: 'R-01',
    check: { kind: 'size', match: { tag: 'a', text: 'Start' }, dimension: 'width' },
    region: { rect: R, source: 'sample' },
    primary: true,
    origin: 'sample',
  }),
  requirement({
    id: 'R-02',
    category: 'colour',
    checkType: 'judged',
    statement: 'The call to action uses the design colour',
    condition: 'Same colour as the design',
    check: { kind: 'judged', question: 'Same colour?' },
    region: { rect: R, source: 'sample' },
    origin: 'sample',
  }),
];

export interface World {
  store: InMemoryProjectStore;
  blobs: InMemoryBlobStore;
  fakeCfg: FakeAiConfig;
  ai: FakeAiEngine;
  service: RunService;
  clock: ReturnType<typeof fixedClock>;
  values: RuntimeValues;
  events: RunEvent[];
  on: (e: RunEvent) => void;
  ctxFor: (o?: { status?: EngineStatus; precomputed?: PrecomputedJudged; projectConsent?: ConsentToken }) => {
    settings: Settings;
    status: EngineStatus;
    projectConsent?: ConsentToken;
    precomputed?: PrecomputedJudged;
  };
}

export interface WorldOptions {
  isSample?: boolean;
  reqs?: Requirement[];
  captures?: { viewport: ViewportId; dom?: DomSnapshot; image?: RgbaImage }[];
  designs?: ViewportId[];
  codec?: ImageCodec;
  fake?: FakeAiConfig;
  values?: Partial<RuntimeValues>;
}

export async function world(o: WorldOptions = {}): Promise<World> {
  const store = new InMemoryProjectStore();
  const blobs = new InMemoryBlobStore();
  const fakeCfg: FakeAiConfig = {
    outputs: { judge: { verdict: 'pass', confidence: 'high', explanation: 'It matches.', suggestedFix: 'None.' } },
    ...o.fake,
  };
  const ai = createFakeAiEngine(fakeCfg, {});
  const clock = fixedClock();
  const values = { ...DEFAULT_RUNTIME_VALUES, ...o.values };
  const config: RuntimeConfig = { get: () => values, refresh: async () => undefined };

  const mkRef = async (img: RgbaImage) => ({
    ...imageRef({ width: W, height: H, cssWidth: W }),
    blobId: await blobs.put(pngBlob(img)),
  });
  const designs: DesignRef[] = [];
  for (const v of o.designs ?? ['desktop']) {
    designs.push({ id: `d-${v}`, viewport: v, image: await mkRef(page(R)), addedAt: 1 });
  }
  const captures: Capture[] = [];
  for (const c of o.captures ?? [{ viewport: 'desktop' as const, dom: cta(132) }]) {
    captures.push({
      id: `c-${c.viewport}`,
      viewport: c.viewport,
      image: await mkRef(c.image ?? page(R)),
      ...(c.dom && { dom: c.dom }),
      addedAt: 1,
      warnings: [],
    });
  }
  const project: Project = {
    id: 'project-1',
    name: 'Sample landing page',
    createdAt: 1,
    updatedAt: 1,
    isSample: o.isSample ?? false,
    designs,
    captures,
    activeContractId: 'contract-1',
    cloudUsage: { requests: 0, bytes: 0 },
  };
  const contract: Contract = {
    id: 'contract-1',
    projectId: 'project-1',
    version: 1,
    createdAt: 1,
    locked: false,
    requirements: o.reqs ?? requirements(),
  };
  await store.put(project);
  await store.putContract(contract);

  const service = createRunService({
    ai,
    config,
    store,
    blobs,
    codec: o.codec ?? createNodeImageCodec(),
    measure: inlineMeasureClient(),
    clock,
    ids: {
      next: (() => {
        let n = 0;
        return () => `run-${++n}`;
      })(),
    },
  });
  const events: RunEvent[] = [];
  const on = (e: RunEvent) => {
    events.push(e);
  };
  return {
    store,
    blobs,
    fakeCfg,
    ai,
    service,
    clock,
    values,
    events,
    on,
    ctxFor: (c = {}) => ({
      settings: sampleSettings({ onboarded: true }),
      status: c.status ?? status(),
      ...(c.projectConsent && { projectConsent: c.projectConsent }),
      ...(c.precomputed && { precomputed: c.precomputed }),
    }),
  };
}
