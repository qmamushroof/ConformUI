import {
  type AiMode,
  type ConsentToken,
  CuiError,
  type EngineStatus,
  type ModePlan,
  mintConsent,
  resolveMode,
  type Settings,
} from '@kernel';
import { describe, expect, it } from 'vitest';

// SPEC-KERNEL-04..06, SPEC §4.1.4, S1, PRD-M-06: mode resolution is one pure function; the table below is the proof.

const project = mintConsent({ scope: 'project', projectId: 'p1' }, { isTrusted: true });
const deep = mintConsent({ scope: 'deep', runId: 'r1' }, { isTrusted: true });

const status = (over: Partial<EngineStatus> = {}): EngineStatus => ({
  device: 'available',
  deviceImage: true,
  online: true,
  cloud: 'enabled',
  ...over,
});

type Input = Parameters<typeof resolveMode>[0];
const first = (over: Partial<Input> = {}): Input => ({
  setting: 'auto',
  purpose: 'first-pass',
  needsImage: true,
  status: status(),
  ...over,
});

describe('SPEC-KERNEL-04, SPEC §4.1.4: mintConsent', () => {
  it('SPEC-KERNEL-04: a trusted event mints a project token carrying its scope and id', () => {
    expect(mintConsent({ scope: 'project', projectId: 'p9' }, { isTrusted: true })).toMatchObject({
      __brand: 'consent',
      scope: 'project',
      projectId: 'p9',
    });
  });

  it('SPEC-KERNEL-04: a trusted event mints a deep token carrying its run id', () => {
    expect(mintConsent({ scope: 'deep', runId: 'r9' }, { isTrusted: true })).toMatchObject({
      __brand: 'consent',
      scope: 'deep',
      runId: 'r9',
    });
  });

  it('SPEC-KERNEL-04, PRD-H-04: isTrusted:false throws CONSENT_REQUIRED (project and deep)', () => {
    for (const scope of [
      { scope: 'project', projectId: 'p' },
      { scope: 'deep', runId: 'r' },
    ] as const) {
      let err: unknown;
      try {
        mintConsent(scope, { isTrusted: false });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(CuiError);
      expect((err as CuiError).code).toBe('CONSENT_REQUIRED');
      expect((err as CuiError).retryable).toBe(false);
    }
  });

  it('SPEC-KERNEL-04: a non-boolean isTrusted (forged event object) is not trusted', () => {
    expect(() =>
      mintConsent({ scope: 'project', projectId: 'p' }, { isTrusted: 'true' as unknown as boolean }),
    ).toThrow(CuiError);
    expect(() => mintConsent({ scope: 'project', projectId: 'p' }, {} as { isTrusted: boolean })).toThrow(CuiError);
  });

  it('SPEC-KERNEL-04: tokens are immutable', () => {
    expect(Object.isFrozen(project)).toBe(true);
  });
});

describe('SPEC-KERNEL-04: purpose deep', () => {
  it('SPEC-KERNEL-04: deep with a deep consent -> ONLY_IN_CLOUD carrying the token', () => {
    expect(resolveMode(first({ purpose: 'deep', deepConsent: deep }))).toEqual({
      kind: 'call',
      mode: 'ONLY_IN_CLOUD',
      consent: deep,
    });
  });

  it('SPEC-KERNEL-04: deep without consent -> needs-consent (cloud)', () => {
    expect(resolveMode(first({ purpose: 'deep' }))).toEqual({ kind: 'needs-consent', why: 'cloud-only-mode' });
  });

  it('SPEC-KERNEL-04: a project token is not a deep consent', () => {
    expect(resolveMode(first({ purpose: 'deep', deepConsent: project as unknown as ConsentToken }))).toEqual({
      kind: 'needs-consent',
      why: 'cloud-only-mode',
    });
    expect(resolveMode(first({ purpose: 'deep', projectConsent: project })).kind).toBe('needs-consent');
  });

  it('SPEC-KERNEL-04: deep ignores the device and the first-pass setting', () => {
    for (const setting of ['auto', 'cloud-only'] as const) {
      for (const device of ['available', 'downloadable', 'downloading', 'unavailable'] as const) {
        const plan = resolveMode(first({ purpose: 'deep', setting, deepConsent: deep, status: status({ device }) }));
        expect(plan).toEqual({ kind: 'call', mode: 'ONLY_IN_CLOUD', consent: deep });
      }
    }
  });

  it('SPEC-KERNEL-04: offline -> blocked offline, with or without consent', () => {
    expect(resolveMode(first({ purpose: 'deep', deepConsent: deep, status: status({ online: false }) }))).toEqual({
      kind: 'blocked',
      reason: 'offline',
    });
    expect(resolveMode(first({ purpose: 'deep', status: status({ online: false }) }))).toEqual({
      kind: 'blocked',
      reason: 'offline',
    });
  });

  it('SPEC-KERNEL-04: cloud disabled -> blocked cloud-disabled', () => {
    expect(resolveMode(first({ purpose: 'deep', deepConsent: deep, status: status({ cloud: 'disabled' }) }))).toEqual({
      kind: 'blocked',
      reason: 'cloud-disabled',
    });
  });

  it('SPEC-KERNEL-04: offline wins over cloud disabled when both hold (SPEC order)', () => {
    expect(
      resolveMode(first({ purpose: 'deep', deepConsent: deep, status: status({ online: false, cloud: 'disabled' }) })),
    ).toEqual({ kind: 'blocked', reason: 'offline' });
  });

  it('SPEC-KERNEL-06 [P1]: on-device-only never reaches the cloud, deep included', () => {
    expect(resolveMode(first({ purpose: 'deep', setting: 'on-device-only', deepConsent: deep }))).toEqual({
      kind: 'blocked',
      reason: 'cloud-disabled',
    });
  });
});

describe('SPEC-KERNEL-05: auto, no project consent', () => {
  const rows: [string, Partial<Input>, ModePlan][] = [
    ['available + image support + needsImage', first(), { kind: 'call', mode: 'ONLY_ON_DEVICE' }],
    [
      'available + no image support + text-only task',
      first({ needsImage: false, status: status({ deviceImage: false }) }),
      { kind: 'call', mode: 'ONLY_ON_DEVICE' },
    ],
    [
      'available + unknown image support + text-only task',
      first({ needsImage: false, status: status({ deviceImage: 'unknown' }) }),
      { kind: 'call', mode: 'ONLY_ON_DEVICE' },
    ],
    [
      'available + image support + text-only task',
      first({ needsImage: false }),
      { kind: 'call', mode: 'ONLY_ON_DEVICE' },
    ],
    [
      'available + no image support + needsImage',
      first({ status: status({ deviceImage: false }) }),
      { kind: 'needs-consent', why: 'device-no-image' },
    ],
    [
      'available + unknown image support + needsImage',
      first({ status: status({ deviceImage: 'unknown' }) }),
      { kind: 'needs-consent', why: 'device-no-image' },
    ],
    [
      'downloading + needsImage',
      first({ status: status({ device: 'downloading', downloadProgress: 0.4 }) }),
      { kind: 'needs-consent', why: 'device-downloading' },
    ],
    [
      'downloading + text-only task',
      first({ needsImage: false, status: status({ device: 'downloading' }) }),
      { kind: 'needs-consent', why: 'device-downloading' },
    ],
    [
      'downloadable',
      first({ status: status({ device: 'downloadable' }) }),
      { kind: 'needs-consent', why: 'device-unavailable' },
    ],
    [
      'unavailable',
      first({ status: status({ device: 'unavailable', reason: 'not-desktop-chrome' }) }),
      { kind: 'needs-consent', why: 'device-unavailable' },
    ],
    [
      'unavailable + text-only task',
      first({ needsImage: false, status: status({ device: 'unavailable' }) }),
      { kind: 'needs-consent', why: 'device-unavailable' },
    ],
    [
      'available, offline (device works offline)',
      first({ status: status({ online: false }) }),
      { kind: 'call', mode: 'ONLY_ON_DEVICE' },
    ],
    [
      'available, cloud disabled (device does not need the cloud)',
      first({ status: status({ cloud: 'disabled' }) }),
      { kind: 'call', mode: 'ONLY_ON_DEVICE' },
    ],
  ];
  for (const [name, input, expected] of rows) {
    it(`SPEC-KERNEL-05: ${name}`, () => {
      expect(resolveMode(input as Input)).toEqual(expected);
    });
  }

  it('SPEC-KERNEL-05: a deep token passed as project consent does not count as consent', () => {
    expect(
      resolveMode(
        first({ projectConsent: deep as unknown as ConsentToken, status: status({ device: 'unavailable' }) }),
      ),
    ).toEqual({
      kind: 'needs-consent',
      why: 'device-unavailable',
    });
  });
});

describe('SPEC-KERNEL-06: auto with project consent, cloud-only and on-device-only', () => {
  it('SPEC-KERNEL-06: auto + consent -> PREFER_ON_DEVICE carrying the token, whatever the device', () => {
    for (const device of ['available', 'downloadable', 'downloading', 'unavailable'] as const) {
      expect(resolveMode(first({ projectConsent: project, status: status({ device }) }))).toEqual({
        kind: 'call',
        mode: 'PREFER_ON_DEVICE',
        consent: project,
      });
    }
  });

  it('SPEC-KERNEL-06: auto + consent, offline and device usable -> PREFER_ON_DEVICE (device answers)', () => {
    expect(resolveMode(first({ projectConsent: project, status: status({ online: false }) }))).toEqual({
      kind: 'call',
      mode: 'PREFER_ON_DEVICE',
      consent: project,
    });
  });

  it('SPEC-KERNEL-06: auto + consent, offline and device not usable -> blocked offline', () => {
    for (const device of ['downloadable', 'downloading', 'unavailable'] as const) {
      expect(resolveMode(first({ projectConsent: project, status: status({ online: false, device }) }))).toEqual({
        kind: 'blocked',
        reason: 'offline',
      });
    }
    expect(
      resolveMode(first({ projectConsent: project, status: status({ online: false, deviceImage: false }) })),
    ).toEqual({ kind: 'blocked', reason: 'offline' });
  });

  it('SPEC-KERNEL-06, SPEC-AI-09: auto + consent + cloud disabled -> device only when usable, else blocked cloud-disabled', () => {
    expect(resolveMode(first({ projectConsent: project, status: status({ cloud: 'disabled' }) }))).toEqual({
      kind: 'call',
      mode: 'ONLY_ON_DEVICE',
    });
    expect(
      resolveMode(first({ projectConsent: project, status: status({ cloud: 'disabled', device: 'unavailable' }) })),
    ).toEqual({ kind: 'blocked', reason: 'cloud-disabled' });
  });

  it('SPEC-KERNEL-06: cloud-only without consent -> needs-consent cloud-only-mode', () => {
    expect(resolveMode(first({ setting: 'cloud-only' }))).toEqual({ kind: 'needs-consent', why: 'cloud-only-mode' });
  });

  it('SPEC-KERNEL-06: cloud-only with consent -> ONLY_IN_CLOUD, even when the device is available', () => {
    expect(resolveMode(first({ setting: 'cloud-only', projectConsent: project }))).toEqual({
      kind: 'call',
      mode: 'ONLY_IN_CLOUD',
      consent: project,
    });
  });

  it('SPEC-KERNEL-06: cloud-only offline -> blocked offline; cloud disabled -> blocked cloud-disabled', () => {
    expect(
      resolveMode(first({ setting: 'cloud-only', projectConsent: project, status: status({ online: false }) })),
    ).toEqual({ kind: 'blocked', reason: 'offline' });
    expect(
      resolveMode(first({ setting: 'cloud-only', projectConsent: project, status: status({ cloud: 'disabled' }) })),
    ).toEqual({ kind: 'blocked', reason: 'cloud-disabled' });
  });

  it('SPEC-KERNEL-06 [P1]: on-device-only -> ONLY_ON_DEVICE when usable, else blocked device-unavailable, never cloud', () => {
    expect(resolveMode(first({ setting: 'on-device-only' }))).toEqual({ kind: 'call', mode: 'ONLY_ON_DEVICE' });
    expect(
      resolveMode(first({ setting: 'on-device-only', needsImage: false, status: status({ deviceImage: false }) })),
    ).toEqual({ kind: 'call', mode: 'ONLY_ON_DEVICE' });
    expect(
      resolveMode(
        first({ setting: 'on-device-only', projectConsent: project, status: status({ device: 'unavailable' }) }),
      ),
    ).toEqual({ kind: 'blocked', reason: 'device-unavailable' });
    expect(
      resolveMode(
        first({ setting: 'on-device-only', projectConsent: project, status: status({ deviceImage: false }) }),
      ),
    ).toEqual({ kind: 'blocked', reason: 'device-unavailable' });
    expect(resolveMode(first({ setting: 'on-device-only', status: status({ device: 'downloading' }) }))).toEqual({
      kind: 'blocked',
      reason: 'device-unavailable',
    });
  });
});

describe('PRD-M-06, S1, SPEC-AI-02: exhaustive guard properties over every input combination', () => {
  const settings: Settings['mode'][] = ['auto', 'cloud-only', 'on-device-only'];
  const purposes = ['first-pass', 'deep'] as const;
  const devices = ['available', 'downloadable', 'downloading', 'unavailable'] as const;
  const images = [true, false, 'unknown'] as const;
  const bools = [true, false];
  const clouds = ['enabled', 'disabled'] as const;
  const projectChoices: (ConsentToken | undefined)[] = [undefined, project];
  const deepChoices: (ConsentToken | undefined)[] = [undefined, deep];

  const all: { input: Input; plan: ModePlan }[] = [];
  for (const setting of settings)
    for (const purpose of purposes)
      for (const needsImage of bools)
        for (const device of devices)
          for (const deviceImage of images)
            for (const online of bools)
              for (const cloud of clouds)
                for (const projectConsent of projectChoices)
                  for (const deepConsent of deepChoices) {
                    const input: Input = {
                      setting,
                      purpose,
                      needsImage,
                      status: { device, deviceImage, online, cloud },
                      ...(projectConsent ? { projectConsent } : {}),
                      ...(deepConsent ? { deepConsent } : {}),
                    };
                    all.push({ input, plan: resolveMode(input) });
                  }

  it('PRD-M-06, S1: the sweep covers every combination', () => {
    expect(all).toHaveLength(3 * 2 * 2 * 4 * 3 * 2 * 2 * 2 * 2);
  });

  it('PRD-M-06, S1: no PREFER_* without a project consent token', () => {
    for (const { input, plan } of all) {
      if (plan.kind === 'call' && plan.mode === 'PREFER_ON_DEVICE') {
        expect(input.projectConsent, JSON.stringify(input)).toBeDefined();
        expect(plan.consent).toEqual(input.projectConsent);
      }
    }
  });

  it('PRD-M-06, S1: no PREFER_IN_CLOUD is ever produced (S4)', () => {
    for (const { plan } of all) expect((plan as { mode?: string }).mode).not.toBe('PREFER_IN_CLOUD');
  });

  it('PRD-M-06, S1: ONLY_IN_CLOUD only with the matching consent scope (deep for deep, project otherwise)', () => {
    for (const { input, plan } of all) {
      if (plan.kind === 'call' && plan.mode === 'ONLY_IN_CLOUD') {
        expect(plan.consent?.scope, JSON.stringify(input)).toBe(input.purpose === 'deep' ? 'deep' : 'project');
        expect(plan.consent).toEqual(input.purpose === 'deep' ? input.deepConsent : input.projectConsent);
      }
    }
  });

  it('S1, SPEC-AI-02 (c): ONLY_ON_DEVICE only when the device is available, and carries no consent', () => {
    for (const { input, plan } of all) {
      if (plan.kind === 'call' && plan.mode === 'ONLY_ON_DEVICE') {
        expect(input.status.device, JSON.stringify(input)).toBe('available');
        expect(plan.consent).toBeUndefined();
        if (input.needsImage) expect(input.status.deviceImage).toBe(true);
      }
    }
  });

  it('PRD-M-06, PRD-D-16: with no consent token at all, no plan ever reaches the cloud', () => {
    const cloudModes: AiMode[] = ['PREFER_ON_DEVICE', 'ONLY_IN_CLOUD'];
    for (const { input, plan } of all) {
      if (!input.projectConsent && !input.deepConsent) {
        expect(plan.kind === 'call' && cloudModes.includes(plan.mode), JSON.stringify(input)).toBe(false);
      }
    }
  });

  it('SPEC-KERNEL-06 [P1]: on-device-only never produces a cloud-capable mode', () => {
    for (const { input, plan } of all) {
      if (input.setting === 'on-device-only') {
        expect(plan.kind === 'call' && plan.mode !== 'ONLY_ON_DEVICE', JSON.stringify(input)).toBe(false);
      }
    }
  });

  it('SPEC-KERNEL-04..06: resolveMode is pure (same input, equal output) and does not mutate its input', () => {
    const input = first({ projectConsent: project });
    const before = structuredClone(input);
    expect(resolveMode(input)).toEqual(resolveMode(input));
    expect(input).toEqual(before);
  });
});
