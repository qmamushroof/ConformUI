import type { ImageCodec, Rect } from '@kernel';
import { describe, expect, it } from 'vitest';
import { createNodeImageCodec } from '../../helpers/node-codec';
import { consent, H, R, status, W, world } from './harness';

// SPEC-AI-11, SPEC-RUN-01 step 3: the judged image carries context and is letterboxed for the on-device model.

type PairOpts = { letterbox?: boolean } | undefined;
interface Spy {
  codec: ImageCodec;
  pairs: { dr: Rect; cr: Rect; maxSide: number; opts: PairOpts }[];
}

function spied(): Spy {
  const base = createNodeImageCodec();
  const pairs: Spy['pairs'] = [];
  const codec: ImageCodec = {
    ...base,
    async composePair(design, dr, capture, cr, maxSide, opts?: PairOpts) {
      pairs.push({ dr, cr, maxSide, opts });
      return (base.composePair as (...a: unknown[]) => ReturnType<ImageCodec['composePair']>)(
        design,
        dr,
        capture,
        cr,
        maxSide,
        opts,
      );
    },
  };
  return { codec, pairs };
}

const inside = (inner: Rect, outer: Rect) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.w >= inner.x + inner.w &&
  outer.y + outer.h >= inner.y + inner.h;

describe('judged pair image on-device', () => {
  it('is letterboxed and both crops carry context around the region, clamped to the image', async () => {
    const spy = spied();
    const w = await world({ codec: spy.codec });
    await w.service.start('project-1', w.ctxFor(), w.on);
    expect(spy.pairs).toHaveLength(1);
    const p = spy.pairs[0];
    expect(p?.opts?.letterbox).toBe(true);
    expect(p?.maxSide).toBe(1024);
    for (const r of [p?.dr, p?.cr] as Rect[]) {
      expect(inside(R, r)).toBe(true);
      expect(r.w * r.h).toBeGreaterThan(R.w * R.h);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(W);
      expect(r.y + r.h).toBeLessThanOrEqual(H);
      expect(r.w / r.h).toBeLessThanOrEqual(3.01);
    }
  });

  it('tells the model where the requirement region lies and that grey bars are padding', async () => {
    const w = await world({ codec: spied().codec });
    await w.service.start('project-1', w.ctxFor(), w.on);
    const call = w.ai.calls[0];
    expect(call?.user).toMatch(/grey|gray/i);
    expect(call?.user).toMatch(/"image":"design (on the left|on top)/);
  });

  it('the Finding evidence still points at the requirement region, not the context', async () => {
    const w = await world({
      codec: spied().codec,
      fake: { outputs: { judge: { verdict: 'fail', confidence: 'high', explanation: 'x', suggestedFix: 'y' } } },
    });
    const run = await w.service.start('project-1', w.ctxFor(), w.on);
    const r = run.results.find((x) => x.requirementId === 'R-02');
    expect(r?.finding?.evidence?.designCrop).toEqual(R);
  });
});

describe('judged pair image in the cloud', () => {
  it('is not letterboxed and keeps the exact regions', async () => {
    const spy = spied();
    const w = await world({
      codec: spy.codec,
      captures: [{ viewport: 'desktop' }],
    });
    const ctx = w.ctxFor({ status: status({ device: 'unavailable', deviceImage: false }), projectConsent: consent() });
    await w.service.start('project-1', { ...ctx, settings: { ...ctx.settings, mode: 'cloud-only' } }, w.on);
    const p = spy.pairs[0];
    expect(p).toBeDefined();
    expect(p?.opts?.letterbox).toBeFalsy();
    expect(p?.maxSide).toBe(1536);
    expect(p?.dr).toEqual(R);
  });
});

describe('judge prompt', () => {
  it('does not let a visible difference pass and sends doubt to uncertain', async () => {
    const w = await world();
    await w.service.start('project-1', w.ctxFor(), w.on);
    const sys = w.ai.calls[0]?.system ?? '';
    expect(sys).toMatch(/grey|gray/i);
    expect(sys).toMatch(/on the left.*on top|on top.*on the left/is);
    expect(sys).toMatch(/hue|colour/i);
    expect(sys).toMatch(/icon/i);
    expect(sys).toMatch(/"pass" only when/i);
    expect(sys).toMatch(/uncertain/);
  });
});
