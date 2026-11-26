import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Run } from '@kernel';
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createSampleProject } from '../../../src/app/flows/sample';
import { AppRoutes } from '../../../src/app/routes';
import { ServicesProvider } from '../../../src/app/services';
import { createFakeAiEngine, type FakeAiConfig } from '../../../src/app/testing/fake-ai-engine';
import { loadSampleAssets, type SampleAssets } from '../../../src/features/demo';
import { createAppTestCodec } from '../../helpers/app-codec';
import { sequentialIds } from '../../helpers/clock-ids';
import { composeForTest } from '../../helpers/compose-test';
import { InMemoryBlobStore, InMemoryProjectStore, InMemorySettingsStore } from '../../helpers/memory-stores';

// ROADMAP 7.3: the cross-feature flows through the real routes, services and sample, with the FakeAiEngine seam.
// jsdom clicks are never trusted, so `mintConsent` is wrapped to trust them unless a test turns that off.

const trust = vi.hoisted(() => ({ on: true }));
vi.mock('@kernel', async (orig) => {
  const m = await orig<typeof import('@kernel')>();
  return {
    ...m,
    mintConsent: (s: never, ev: { isTrusted: boolean }) => m.mintConsent(s, trust.on ? { isTrusted: true } : ev),
  };
});

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
// Real images go through the whole Run in jsdom: slow on a loaded machine.
configure({ asyncUtilTimeout: 60_000 });

const sampleDir = resolve(__dirname, '../../../src/features/demo/sample');
let assets: SampleAssets;

beforeAll(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const rel = decodeURIComponent(new URL(String(input), 'http://x').pathname).replace(
        /^.*\/features\/demo\/sample\//,
        '',
      );
      return new Response(new Uint8Array(readFileSync(join(sampleDir, rel))), {
        headers: { 'content-type': rel.endsWith('.png') ? 'image/png' : 'application/json' },
      });
    }),
  );
  assets = await loadSampleAssets();
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  trust.on = true;
});

const Probe = () => <output data-testid="loc">{`${useLocation().pathname}${useLocation().search}`}</output>;

async function mount(fake: FakeAiConfig = {}, path = '/') {
  const calls: NonNullable<FakeAiConfig['calls']> = [];
  const cfg: FakeAiConfig = { calls, ...fake };
  const settingsStore = new InMemorySettingsStore({
    mode: 'auto',
    onboarded: true,
    deepUsage: { day: '', count: 0 },
    everSentToCloud: false,
  });
  const { services } = await composeForTest({
    ai: createFakeAiEngine(cfg, {}),
    storage: { projects: new InMemoryProjectStore(), blobs: new InMemoryBlobStore(), settings: settingsStore },
    codec: createAppTestCodec(),
    sample: async () => assets,
    ids: sequentialIds('t'),
  });
  render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes appVersion="test" onReload={vi.fn()} />
        <Probe />
      </MemoryRouter>
    </ServicesProvider>,
  );
  return { services, calls, settingsStore };
}

const click = (name: string | RegExp, role: 'button' | 'link' = 'button') =>
  fireEvent.click(screen.getByRole(role, { name }));
const loc = () => screen.getByTestId('loc').textContent ?? '';

/** Two clicks from Projects: Try the sample, then Run. */
/** `viaLink`: click Try the sample first (jsdom navigation through the shell's link handler); otherwise start at /?sample=1, which that link opens. */
async function sampleToFindings(viaLink = false) {
  if (viaLink) fireEvent.click((await screen.findAllByRole('link', { name: 'Try the sample' }))[0] as HTMLElement);
  await screen.findByRole('heading', { level: 1, name: 'Sample landing page' });
  click('Run');
  await screen.findByRole('heading', { level: 1, name: 'Run 1' }, { timeout: 90_000 });
}

const AVAILABLE = { device: 'available', deviceImage: true, online: true, cloud: 'enabled' } as const;
const NO_DEVICE = {
  device: 'unavailable',
  deviceImage: false,
  reason: 'not-desktop-chrome',
  online: true,
  cloud: 'enabled',
} as const;

describe('7.3 sample flow', () => {
  it('SPEC-DEMO-02, PRD-M-13, S25: Findings are two clicks from Projects with the device available and image input on', async () => {
    const { calls, services } = await mount({ status: AVAILABLE });
    await sampleToFindings(true);
    expect(loc()).toMatch(/^\/p\/[^/]+\/run\/(?!new)[^/]+$/);
    expect(screen.getByTestId('run-summary')).toBeTruthy();
    // On-device only: nothing cloud-capable was requested, nothing was recorded.
    expect(calls.every((c) => c.mode === 'ONLY_ON_DEVICE')).toBe(true);
    const [p] = await services.store.list();
    expect(p?.isSample).toBe(true);
    expect(p?.cloudUsage).toEqual({ requests: 0, bytes: 0 });
    expect((await services.settingsStore.read()).everSentToCloud).toBe(false);
  });

  it('SPEC-DEMO-02, SPEC-RUN-13, PRD-M-13, PRD-M-06: with the device unavailable there is no modal, the pre-computed items are labelled and no AI request is made', async () => {
    const { calls } = await mount({ status: NO_DEVICE }, '/?sample=1');
    await sampleToFindings();
    expect(await screen.findByText('Sample results (pre-computed)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Allow cloud to judge live' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('SPEC-DEMO-02: Try the sample twice makes two Projects with separate Contracts', async () => {
    const { services } = await composeForTest({
      ai: createFakeAiEngine({}, {}),
      storage: {
        projects: new InMemoryProjectStore(),
        blobs: new InMemoryBlobStore(),
        settings: new InMemorySettingsStore(),
      },
      codec: createAppTestCodec(),
      sample: async () => assets,
      ids: sequentialIds('s'),
    });
    await createSampleProject(services);
    await createSampleProject(services);
    const all = await services.store.list();
    expect(all).toHaveLength(2);
    expect(new Set(all.map((p) => p.activeContractId)).size).toBe(2);
    expect(all.every((p) => p.isSample)).toBe(true);
  });

  it('SPEC-RUN-13, SPEC-PROJ-07, SPEC-APP-01, SPEC-SET-06, PRD-M-06: Allow cloud to judge live asks first, keeps the Run id, adds Cloud bytes to cloudUsage and sets everSentToCloud once', async () => {
    const { calls, services, settingsStore } = await mount({ status: NO_DEVICE }, '/?sample=1');
    await sampleToFindings();
    const runUrl = loc();
    await screen.findByText('Sample results (pre-computed)');
    const writes = vi.spyOn(settingsStore, 'write');

    click('Allow cloud to judge live');
    await screen.findByRole('heading', { name: 'Allow cloud for this project?' });
    expect(calls).toHaveLength(0); // nothing is sent before Allow
    click('Allow for this project');

    await waitFor(() => expect(calls.length).toBeGreaterThan(0), { timeout: 90_000 });
    expect(calls.every((c) => c.mode !== 'ONLY_ON_DEVICE' && c.consent?.scope === 'project')).toBe(true);
    await waitFor(async () => expect((await services.store.list())[0]?.cloudUsage.requests).toBeGreaterThan(0));
    const [p] = await services.store.list();
    expect(p?.cloudConsent).toBeTruthy();
    expect(p?.cloudUsage.requests).toBe(calls.length);
    expect(p?.cloudUsage.bytes).toBeGreaterThan(0);
    expect(loc()).toBe(runUrl); // same Run id
    const runs = await services.store.listRuns(p?.id ?? '');
    expect(runs).toHaveLength(1);
    const flips = writes.mock.calls.filter(([w]) => (w as { everSentToCloud?: boolean }).everSentToCloud === true);
    expect(flips).toHaveLength(1);
    expect((await settingsStore.read()).everSentToCloud).toBe(true);
  });

  it('SPEC-PROJ-07, PRD-H-04: an untrusted click on Allow grants nothing and sends nothing', async () => {
    const { calls, services } = await mount({ status: NO_DEVICE }, '/?sample=1');
    await sampleToFindings();
    trust.on = false;
    click('Allow cloud to judge live');
    await screen.findByRole('heading', { name: 'Allow cloud for this project?' });
    click('Allow for this project');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Allow cloud for this project?' })).toBeNull());
    expect(calls).toHaveLength(0);
    expect((await services.store.list())[0]?.cloudConsent).toBeUndefined();
  });
});

describe('7.3 consent for extraction', () => {
  it('SPEC-CON-01, SPEC-DEMO-05, PRD-M-06: Extract asks before any request; Decline shows the labelled pre-computed extraction', async () => {
    const { calls, services } = await mount({ status: NO_DEVICE }, '/?sample=1');
    await screen.findByRole('heading', { level: 1, name: 'Sample landing page' });
    const [p] = await services.store.list();
    cleanup();
    await mountAt(services, `/p/${p?.id}/contract`);
    await screen.findByRole('button', { name: 'Extract contract' });
    click('Extract contract');
    await screen.findByRole('heading', { name: 'Allow cloud for this project?' });
    expect(calls).toHaveLength(0);
    click('Decline');
    expect(await screen.findByText(/Sample results \(pre-computed\)/)).toBeTruthy();
    expect(calls).toHaveLength(0);
    expect((await services.store.get(p?.id ?? ''))?.pendingAiContractId).toBeTruthy();
  });

  it('SPEC-SET-05, SPEC-PROJ-07: after Revoke the next Extract asks again; Cloud steps add bytes to cloudUsage', async () => {
    const { calls, services } = await mount({ status: NO_DEVICE }, '/?sample=1');
    await screen.findByRole('heading', { level: 1, name: 'Sample landing page' });
    const [p] = await services.store.list();
    const id = p?.id ?? '';
    cleanup();
    await mountAt(services, `/p/${id}/contract`);
    await screen.findByRole('button', { name: 'Extract contract' });
    click('Extract contract');
    await screen.findByRole('heading', { name: 'Allow cloud for this project?' });
    click('Allow for this project');
    await waitFor(() => expect(calls.length).toBeGreaterThan(0), { timeout: 30_000 });
    const steps = async () => {
      const pending = (await services.store.get(id))?.pendingAiContractId;
      return pending
        ? ((await services.store.getContract(pending))?.extraction ?? []).filter((t) => t.engine === 'cloud').length
        : 0;
    };
    await waitFor(async () => expect(await steps()).toBeGreaterThan(0));
    await waitFor(async () => expect((await services.store.get(id))?.cloudUsage.requests).toBe(await steps()));
    expect((await services.store.get(id))?.cloudUsage.bytes).toBeGreaterThan(0);

    // A second Extract in the same session reuses the token: no sheet.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Extract contract' })).toBeTruthy());
    await services.projects.revokeCloudConsent(id);
    expect((await services.store.get(id))?.cloudConsent).toBeUndefined();
    click('Extract contract');
    expect(await screen.findByRole('heading', { name: 'Allow cloud for this project?' })).toBeTruthy();
  });
});

describe('7.3 Deep Analysis and Re-verify', () => {
  it('SPEC-DEEP-01, SPEC-APP-01: Deep Analysis lists what is sent, sends only after Send to cloud, and records the Cloud step', async () => {
    const { calls, services } = await mount({ status: NO_DEVICE }, '/?sample=1');
    await sampleToFindings();
    click('Deep Analysis');
    await screen.findByRole('heading', { name: 'Send this run for Deep Analysis?' });
    expect(calls.filter((c) => c.task === 'deep-analysis')).toHaveLength(0);
    click('Send to cloud');
    await waitFor(() => expect(calls.some((c) => c.task === 'deep-analysis')).toBe(true), { timeout: 30_000 });
    const deep = calls.find((c) => c.task === 'deep-analysis');
    expect(deep?.consent?.scope).toBe('deep');
    await waitFor(async () => expect((await services.store.list())[0]?.cloudUsage.requests).toBe(1));
  });

  it('SPEC-DEMO-05, SPEC-DEEP-01: after a failed Deep request, Show pre-computed result applies the stored refinement, labelled', async () => {
    await mount({ status: NO_DEVICE, errors: { 'deep-analysis': 'AI_FAILED' } }, '/?sample=1');
    await sampleToFindings();
    click('Deep Analysis');
    await screen.findByRole('heading', { name: 'Send this run for Deep Analysis?' });
    click('Send to cloud');
    const show = await screen.findByRole('button', { name: 'Show pre-computed result' }, { timeout: 30_000 });
    fireEvent.click(show);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Show pre-computed result' })).toBeNull());
    expect(screen.getByText('Sample results (pre-computed)')).toBeTruthy();
  });

  it('SPEC-DEMO-04, SPEC-RUN-09, PRD-M-02: Load fixed implementation then Re-verify shows resolved and remaining findings', async () => {
    const { services } = await mount({ status: AVAILABLE }, '/?sample=1');
    await sampleToFindings();
    click('Re-verify');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Load fixed implementation' }));
    await waitFor(() => expect(within(dialog).getAllByText(/DOM snapshot added/).length).toBeGreaterThan(0));
    await waitFor(async () => {
      const [p] = await services.store.list();
      expect(p?.captures.every((c) => c.dom?.page.url.includes('/fixed'))).toBe(true);
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run Re-verify' }));
    await screen.findByRole('heading', { level: 1, name: 'Run 2' }, { timeout: 90_000 });
    const [p] = await services.store.list();
    const runs = (await services.store.listRuns(p?.id ?? '')).sort((a: Run, b: Run) => a.createdAt - b.createdAt);
    expect(runs).toHaveLength(2);
    expect(Object.values(runs[1]?.changes ?? {})).toContain('resolved');
    expect(Object.values(runs[1]?.changes ?? {})).toContain('remaining');
  });
});

async function mountAt(services: Awaited<ReturnType<typeof mount>>['services'], path: string) {
  render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes appVersion="test" onReload={vi.fn()} />
        <Probe />
      </MemoryRouter>
    </ServicesProvider>,
  );
}
