import {
  ACCEPTED_INPUT_MIME,
  CuiError,
  ERROR_CODES,
  type ErrorCode,
  MAX_CSS_HEIGHT,
  MAX_INPUT_BYTES,
  MAX_PROJECTS,
  MAX_REQUIREMENTS,
  MAX_SNAPSHOT_BYTES,
  MAX_SNAPSHOT_ELEMENTS,
  MAX_SOURCE_SIDE,
} from '@kernel';
import { describe, expect, it } from 'vitest';

// SPEC-KERNEL-09 (codes and retryable per SPEC §4.1.5 table) and SPEC-KERNEL-07 (limits).

const EXPECTED: Record<ErrorCode, boolean> = {
  IMAGE_UNSUPPORTED: false,
  IMAGE_TOO_LARGE: false,
  IMAGE_DECODE_FAILED: false,
  SNAPSHOT_INVALID: false,
  SNAPSHOT_TOO_LARGE: false,
  DEVICE_UNAVAILABLE: false,
  DEVICE_DOWNLOADING: true,
  DEVICE_NO_IMAGE: false,
  OFFLINE: true,
  CLOUD_DISABLED: false,
  QUOTA_EXCEEDED: true,
  DAILY_CAP: true,
  APPCHECK_FAILED: true,
  AI_NOT_ENABLED: false,
  AI_BAD_OUTPUT: true,
  AI_BLOCKED: false,
  AI_FAILED: true,
  AI_TIMEOUT: true,
  CONSENT_REQUIRED: false,
  CONTRACT_LOCKED: false,
  STORAGE_FAILED: true,
  STORAGE_UNAVAILABLE: true,
};

describe('SPEC-KERNEL-09: CuiError', () => {
  it('SPEC-KERNEL-09: ERROR_CODES lists exactly the 22 SPEC codes', () => {
    expect([...ERROR_CODES].sort()).toEqual(Object.keys(EXPECTED).sort());
    expect(ERROR_CODES).toHaveLength(22);
  });

  for (const [code, retryable] of Object.entries(EXPECTED) as [ErrorCode, boolean][]) {
    it(`SPEC-KERNEL-09: ${code} carries its code and retryable=${retryable}`, () => {
      const e = new CuiError(code);
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(CuiError);
      expect(e.code).toBe(code);
      expect(e.retryable).toBe(retryable);
      expect(e.name).toBe('CuiError');
      expect(e.message).toBe(code);
    });
  }

  it('SPEC-KERNEL-09: a custom message is kept; the code stays the contract', () => {
    const e = new CuiError('AI_FAILED', 'timeout after 60 s');
    expect(e.message).toBe('timeout after 60 s');
    expect(e.code).toBe('AI_FAILED');
  });

  it('SPEC-KERNEL-09: a cause is kept for diagnostics but is not the message', () => {
    const cause = new Error('raw sdk text');
    const e = new CuiError('AI_FAILED', undefined, { cause });
    expect(e.cause).toBe(cause);
    expect(e.message).toBe('AI_FAILED');
  });

  it('SPEC-KERNEL-09: the stack mentions the error name', () => {
    expect(new CuiError('OFFLINE').stack).toContain('CuiError');
  });
});

describe('SPEC-KERNEL-07: limits', () => {
  it('SPEC-KERNEL-07: values equal the SPEC table', () => {
    expect(ACCEPTED_INPUT_MIME).toEqual(['image/png', 'image/jpeg', 'image/webp']);
    expect(MAX_INPUT_BYTES).toBe(20 * 1024 * 1024);
    expect(MAX_SOURCE_SIDE).toBe(8192);
    expect(MAX_CSS_HEIGHT).toBe(16_000);
    expect(MAX_SNAPSHOT_BYTES).toBe(1024 * 1024);
    expect(MAX_SNAPSHOT_ELEMENTS).toBe(1500);
    expect(MAX_REQUIREMENTS).toBe(60);
    expect(MAX_PROJECTS).toBe(50);
  });
});
