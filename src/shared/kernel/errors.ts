// SPEC-KERNEL-09: no raw SDK error reaches the UI. Codes map to copy in SPEC §5.4.

export const ERROR_CODES = [
  'IMAGE_UNSUPPORTED',
  'IMAGE_TOO_LARGE',
  'IMAGE_DECODE_FAILED',
  'SNAPSHOT_INVALID',
  'SNAPSHOT_TOO_LARGE',
  'DEVICE_UNAVAILABLE',
  'DEVICE_DOWNLOADING',
  'DEVICE_NO_IMAGE',
  'OFFLINE',
  'CLOUD_DISABLED',
  'QUOTA_EXCEEDED',
  'DAILY_CAP',
  'APPCHECK_FAILED',
  'AI_NOT_ENABLED',
  'AI_BAD_OUTPUT',
  'AI_BLOCKED',
  'AI_FAILED',
  'CONSENT_REQUIRED',
  'CONTRACT_LOCKED',
  'STORAGE_FAILED',
  'STORAGE_UNAVAILABLE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const RETRYABLE: Record<ErrorCode, boolean> = {
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
  CONSENT_REQUIRED: false,
  CONTRACT_LOCKED: false,
  STORAGE_FAILED: true,
  STORAGE_UNAVAILABLE: true,
};

export class CuiError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  constructor(code: ErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code, options);
    this.name = 'CuiError';
    this.code = code;
    this.retryable = RETRYABLE[code];
  }
}
