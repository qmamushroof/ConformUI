import { CuiError, type ErrorCode, type NotCheckedReason } from '@kernel';
import { describe, expect, it } from 'vitest';
import { stateCopy } from '../../../src/app/copy';
import { precomputedNote, whyFromBlocked, whyFromError } from '../../../src/app/flows/extract-reason';
import { blockedView, errorView } from '../../../src/app/flows/helpers';

// PRD-H-05, SPEC-DEMO-05: the sample's stored extraction says the real reason it is shown, never "you declined" by default.

describe('extract fallback reason', () => {
  const cases: [NotCheckedReason, ErrorCode | undefined, string][] = [
    ['ai-failed', 'AI_TIMEOUT', 'timeout'],
    ['ai-failed', 'AI_FAILED', 'failed'],
    ['ai-failed', undefined, 'failed'],
    ['ai-failed', 'QUOTA_EXCEEDED', 'failed'],
    ['offline', 'OFFLINE', 'offline'],
    ['offline', undefined, 'offline'],
    ['device-unavailable', 'DEVICE_UNAVAILABLE', 'device'],
    ['device-unavailable', 'DEVICE_DOWNLOADING', 'device'],
    ['cloud-disabled', 'CLOUD_DISABLED', 'cloud-disabled'],
    ['mode-on-device-only', undefined, 'cloud-disabled'],
  ];
  for (const [reason, code, why] of cases) {
    it(`whyFromBlocked(${reason}, ${code}) is ${why}`, () => {
      expect(whyFromBlocked(reason, code)).toBe(why);
    });
  }

  it('a thrown error maps by its code; anything else is a failure', () => {
    expect(whyFromError(new CuiError('AI_TIMEOUT'))).toBe('timeout');
    expect(whyFromError(new CuiError('OFFLINE'))).toBe('offline');
    expect(whyFromError(new CuiError('STORAGE_FAILED'))).toBe('failed');
    expect(whyFromError(new Error('boom'))).toBe('failed');
    expect(whyFromError(undefined)).toBe('failed');
  });

  it('only a real decline says "You declined the cloud" (the prototype copy, kept word for word)', () => {
    expect(precomputedNote('declined')).toBe(
      'You declined the cloud, so nothing was sent. These are the sample’s stored extraction results, labelled Pre-computed. The verified contract stays active until you choose below.',
    );
    for (const why of ['timeout', 'failed', 'offline', 'device', 'cloud-disabled'] as const) {
      const text = precomputedNote(why);
      expect(text, why).not.toMatch(/declined/i);
      expect(text, why).toMatch(/Pre-computed/);
      expect(text, why).toMatch(/nothing was sent/i);
    }
    expect(precomputedNote('timeout')).toMatch(/took too long/);
    expect(precomputedNote('offline')).toMatch(/offline/i);
  });

  it('with no recorded reason (after a reload) the note blames nobody', () => {
    const text = precomputedNote(undefined);
    expect(text).not.toMatch(/declined|took too long|offline/i);
    expect(text).toMatch(/Pre-computed/);
  });
});

describe('extraction notices on a project that is not the sample', () => {
  it('AI_TIMEOUT has its own copy, with Try again, and does not claim the cloud was unreachable', () => {
    expect(stateCopy.AI_TIMEOUT.title).toMatch(/took too long/);
    expect(stateCopy.AI_TIMEOUT.title).not.toMatch(/cloud/i);
    expect(stateCopy.AI_TIMEOUT.action).toBe('Try again');
  });

  it('a blocked timeout shows the timeout notice and its code', () => {
    const v = blockedView('ai-failed', 'AI_TIMEOUT');
    expect(v.code).toBe('AI_TIMEOUT');
    expect(v.title).toBe(stateCopy.AI_TIMEOUT.title);
  });

  it('a blocked on-device failure does not say the cloud could not be reached', () => {
    const v = blockedView('ai-failed', 'AI_FAILED');
    expect(v.title).not.toMatch(/cloud/i);
    expect(v.code).toBe('AI_FAILED');
  });

  it('offline and device reasons keep their existing notices', () => {
    expect(blockedView('offline', 'OFFLINE').code).toBe('OFFLINE');
    expect(blockedView('device-unavailable').code).toBe('DEVICE_UNAVAILABLE');
    expect(blockedView('cloud-disabled').code).toBe('CLOUD_DISABLED');
  });
});

describe('SPEC-UI-05: the timeout copy names where the call ran', () => {
  it('a cloud timeout says the cloud model took too long, that nothing was charged, and offers Try again', () => {
    const v = errorView(new CuiError('AI_TIMEOUT', undefined, { engine: 'cloud' }));
    expect(v.code).toBe('AI_TIMEOUT');
    expect(v.title).toMatch(/cloud model took too long/i);
    expect(v.detail).toMatch(/not counted against today/i);
    expect(v.detail).toMatch(/try again/i);
    expect(`${v.title} ${v.detail}`).not.toMatch(/slower device/i);
  });

  it('an on-device timeout keeps the device wording', () => {
    const v = errorView(new CuiError('AI_TIMEOUT', undefined, { engine: 'on-device' }));
    expect(v.title).toBe(stateCopy.AI_TIMEOUT.title);
    expect(v.detail).toMatch(/slower device/);
  });

  it('a timeout of unknown engine keeps the device wording (never claims a charge it cannot know about)', () => {
    const v = errorView(new CuiError('AI_TIMEOUT'));
    expect(v.detail).toBe(stateCopy.AI_TIMEOUT.detail);
  });

  it('other errors are unaffected by an engine', () => {
    expect(errorView(new CuiError('AI_FAILED', undefined, { engine: 'cloud' })).title).toBe(stateCopy.AI_FAILED.title);
  });

  it('a blocked cloud extraction timeout also says cloud', () => {
    const v = blockedView('ai-failed', 'AI_TIMEOUT', 'cloud');
    expect(v.title).toMatch(/cloud model took too long/i);
    expect(blockedView('ai-failed', 'AI_TIMEOUT', 'on-device').detail).toMatch(/slower device/);
  });
});
