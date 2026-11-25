import { type Clock, guardNumbers, type Ids, iou, lockContract, nextContractVersion, suggestViewport } from '@kernel';
import { describe, expect, it } from 'vitest';
import * as s from '../../helpers/samples';

describe('SPEC-KERNEL-08, PRD-P-02, PRD-H-02, PRD-M-03: guardNumbers', () => {
  it('SPEC-KERNEL-08: text without numbers passes, even with nothing allowed', () => {
    expect(guardNumbers('The hero image is cropped.', [])).toBe(true);
    expect(guardNumbers('', [])).toBe(true);
  });

  it('SPEC-KERNEL-08: every number must be an allowed value', () => {
    expect(guardNumbers('CTA is 132 px wide vs 220 px', [132, 220])).toBe(true);
    expect(guardNumbers('CTA is 132 px wide vs 221 px', [132, 220])).toBe(false); // 1 apart, outside +-0.5
  });

  it('SPEC-KERNEL-08: a number not in the allowed list trips the guard (invented number)', () => {
    expect(guardNumbers('CTA is 132 px wide vs 250 px', [132, 220])).toBe(false);
    expect(guardNumbers('About 40 px too narrow', [])).toBe(false);
  });

  it('SPEC-KERNEL-08: tolerance is +-0.5 inclusive', () => {
    expect(guardNumbers('width 100.5', [100])).toBe(true);
    expect(guardNumbers('width 99.5', [100])).toBe(true);
    expect(guardNumbers('width 100.6', [100])).toBe(false);
    expect(guardNumbers('width 99.4', [100])).toBe(false);
  });

  it('SPEC-KERNEL-08: the sign matters (-40 is not 40)', () => {
    expect(guardNumbers('narrower by -40.0%', [-40])).toBe(true);
    expect(guardNumbers('narrower by -40.0%', [40])).toBe(false);
    expect(guardNumbers('wider by 40%', [-40])).toBe(false);
  });

  it('SPEC-KERNEL-08: the typographic minus sign (U+2212) counts as a minus', () => {
    expect(guardNumbers('(−40.0%)', [-40])).toBe(true);
    expect(guardNumbers('(−40.0%)', [40])).toBe(false);
  });

  it('SPEC-KERNEL-08: a decimal comma is a decimal separator', () => {
    expect(guardNumbers('ratio 0,25', [0.25])).toBe(true);
    expect(guardNumbers('ratio 3,5', [3.5])).toBe(true);
    expect(guardNumbers('ratio 3,5', [35])).toBe(false);
  });

  it('SPEC-KERNEL-08: digits glued to words are number tokens (heading names such as h2 need allowing)', () => {
    expect(guardNumbers('the h2 is large', [])).toBe(false);
    expect(guardNumbers('the h2 is large', [2])).toBe(true);
  });

  it('SPEC-KERNEL-08: several numbers are all checked, in any order; one bad number fails the whole text', () => {
    expect(guardNumbers('gap 16 then 24 then 8', [8, 16, 24])).toBe(true);
    expect(guardNumbers('gap 16 then 25 then 8', [8, 16, 24])).toBe(false);
  });

  it('SPEC-KERNEL-08: a thousands comma reads as a decimal, so it trips (falls back to the template, the safe side)', () => {
    expect(guardNumbers('page is 1,200 px', [1200])).toBe(false);
  });

  it('SPEC-KERNEL-08: accepts a readonly list and does not mutate it', () => {
    const allowed: readonly number[] = Object.freeze([1, 2, 3]);
    expect(guardNumbers('1 2 3', allowed)).toBe(true);
  });

  it('SPEC-KERNEL-08: repeated calls give the same answer (no regex state leaks between calls)', () => {
    for (let i = 0; i < 3; i++) {
      expect(guardNumbers('a 5 b 6', [5, 6])).toBe(true);
      expect(guardNumbers('a 5 b 7', [5, 6])).toBe(false);
    }
  });
});

describe('SPEC-KERNEL-10: iou', () => {
  const r = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

  it('SPEC-KERNEL-10: identical rects -> 1', () => {
    expect(iou(r(0, 0, 10, 10), r(0, 0, 10, 10))).toBe(1);
  });

  it('SPEC-KERNEL-10: disjoint rects -> 0', () => {
    expect(iou(r(0, 0, 10, 10), r(20, 20, 5, 5))).toBe(0);
  });

  it('SPEC-KERNEL-10: rects that only touch along an edge -> 0', () => {
    expect(iou(r(0, 0, 10, 10), r(10, 0, 10, 10))).toBe(0);
  });

  it('SPEC-KERNEL-10: half overlap -> 1/3', () => {
    expect(iou(r(0, 0, 10, 10), r(5, 0, 10, 10))).toBeCloseTo(1 / 3, 10);
  });

  it('SPEC-KERNEL-10: containment -> area ratio', () => {
    expect(iou(r(0, 0, 10, 10), r(2, 2, 5, 5))).toBeCloseTo(25 / 100, 10);
  });

  it('SPEC-KERNEL-10: is symmetric', () => {
    const a = r(1, 2, 30, 40);
    const b = r(10, 20, 50, 15);
    expect(iou(a, b)).toBe(iou(b, a));
  });

  it('SPEC-KERNEL-10: zero area on either side -> 0 (including two identical empty rects)', () => {
    expect(iou(r(0, 0, 0, 10), r(0, 0, 10, 10))).toBe(0);
    expect(iou(r(0, 0, 10, 10), r(0, 0, 10, 0))).toBe(0);
    expect(iou(r(0, 0, 0, 0), r(0, 0, 0, 0))).toBe(0);
  });

  it('SPEC-KERNEL-10: negative width or height counts as zero area', () => {
    expect(iou(r(0, 0, -10, 10), r(0, 0, 10, 10))).toBe(0);
  });

  it('SPEC-KERNEL-10: fractional and negative coordinates work', () => {
    expect(iou(r(-5, -5, 10, 10), r(-5, -5, 10, 10))).toBe(1);
    expect(iou(r(0.5, 0.5, 1, 1), r(1, 1, 1, 1))).toBeCloseTo(0.25 / 1.75, 10);
  });

  it('SPEC-KERNEL-10: result stays within 0..1', () => {
    const v = iou(r(0, 0, 3, 7), r(1, 1, 9, 2));
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});

describe('SPEC-KERNEL-11: lockContract and nextContractVersion', () => {
  const ids = (...vals: string[]): Ids => {
    let i = 0;
    return { next: () => vals[i++] ?? `id-${i}` };
  };
  const clock = (t: number): Clock => ({ now: () => t });

  it('SPEC-KERNEL-11: lockContract returns a locked copy and leaves the input untouched', () => {
    const c = s.contract();
    const locked = lockContract(c);
    expect(locked.locked).toBe(true);
    expect(c.locked).toBe(false);
    expect(locked).not.toBe(c);
    expect(locked).toEqual({ ...c, locked: true });
  });

  it('SPEC-KERNEL-11: lockContract is idempotent', () => {
    const once = lockContract(s.contract());
    expect(lockContract(once)).toEqual(once);
  });

  it('SPEC-KERNEL-11: nextContractVersion bumps the version, mints a new id, unlocks, stamps the clock', () => {
    const c = lockContract(s.contract({ version: 3 }));
    const next = nextContractVersion(c, ids('contract-4'), clock(1_800_000_000_000));
    expect(next.version).toBe(4);
    expect(next.id).toBe('contract-4');
    expect(next.id).not.toBe(c.id);
    expect(next.locked).toBe(false);
    expect(next.createdAt).toBe(1_800_000_000_000);
    expect(next.projectId).toBe(c.projectId);
  });

  it('SPEC-KERNEL-11, SPEC-CON-06: Requirement ids and content are preserved', () => {
    const c = lockContract(
      s.contract({
        requirements: [
          s.requirement({ id: 'R-01' }),
          s.requirement({ id: 'I-M-01', viewport: 'mobile', label: 'inferred' }),
        ],
      }),
    );
    const next = nextContractVersion(c, ids('c2'), clock(1));
    expect(next.requirements.map((q) => q.id)).toEqual(['R-01', 'I-M-01']);
    expect(next.requirements).toEqual(c.requirements);
  });

  it('SPEC-KERNEL-11: the copy shares no Requirement objects with the original (editing one cannot alter the other)', () => {
    const c = lockContract(s.contract());
    const next = nextContractVersion(c, ids('c2'), clock(1));
    expect(next.requirements[0]).not.toBe(c.requirements[0]);
    const first = next.requirements[0];
    if (first) first.statement = 'edited';
    expect(c.requirements[0]?.statement).not.toBe('edited');
  });

  it('SPEC-KERNEL-11: the source contract is not mutated', () => {
    const c = lockContract(s.contract());
    const before = structuredClone(c);
    nextContractVersion(c, ids('c2'), clock(1));
    expect(c).toEqual(before);
  });

  it('SPEC-KERNEL-11: consumes exactly one id', () => {
    let calls = 0;
    nextContractVersion(lockContract(s.contract()), { next: () => `c${++calls}` }, clock(1));
    expect(calls).toBe(1);
  });
});

describe('SPEC-KERNEL-12, SPEC-MEAS-04, PRD-F-02.3: suggestViewport', () => {
  const table: [string, number, 'desktop' | 'mobile'][] = [
    ['desktop preset at dpr 1', 1440, 'desktop'],
    ['desktop at dpr 2', 2880, 'desktop'],
    ['desktop at dpr 3', 4320, 'desktop'],
    ['desktop within 5 % below (1368 = -5 %)', 1368, 'desktop'],
    ['desktop within 5 % above (1512 = +5 %)', 1512, 'desktop'],
    ['mobile preset at dpr 1', 390, 'mobile'],
    ['mobile at dpr 2 (iPhone-class 780)', 780, 'mobile'],
    ['mobile at dpr 3 (1170)', 1170, 'mobile'],
    ['mobile within 5 % (409 css)', 409, 'mobile'],
    ['768 wide resolves to mobile at dpr 2 (384 css), tablet is P1', 768, 'mobile'],
    ['1600: no preset within 5 % at any dpr, >= 1024 css -> desktop', 1600, 'desktop'],
    ['1920 full HD -> desktop (fallback)', 1920, 'desktop'],
    ['1024 is the desktop floor', 1024, 'desktop'],
    ['1023 is below the floor -> mobile', 1023, 'mobile'],
    ['1000 -> mobile (fallback)', 1000, 'mobile'],
    ['500 -> mobile (fallback)', 500, 'mobile'],
    ['320 -> mobile (fallback)', 320, 'mobile'],
    ['1200 is 400 css at dpr 3, within 5 % of 390 -> mobile', 1200, 'mobile'],
    ['1100 is 366.7 css at dpr 3, 6 % off 390 -> fallback desktop', 1100, 'desktop'],
    ['1160 is 386.7 css at dpr 3 -> mobile', 1160, 'mobile'],
    ['819 is 409.5 css at dpr 2, exactly +5 % -> mobile', 819, 'mobile'],
    ['1230 is 410 css at dpr 3, 5.1 % above -> fallback desktop', 1230, 'desktop'],
    ['3000 is 1500 css at dpr 2, 4.2 % above 1440 -> desktop', 3000, 'desktop'],
  ];
  for (const [name, width, expected] of table) {
    it(`SPEC-KERNEL-12, SPEC-MEAS-04: ${name} (${width}) -> ${expected}`, () => {
      expect(suggestViewport(width)).toBe(expected);
    });
  }

  it('SPEC-KERNEL-12: invalid widths (0, negative, NaN, Infinity) give the default Desktop', () => {
    for (const w of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) expect(suggestViewport(w)).toBe('desktop');
  });

  it('SPEC-KERNEL-12: is deterministic', () => {
    expect(suggestViewport(1234)).toBe(suggestViewport(1234));
  });
});
