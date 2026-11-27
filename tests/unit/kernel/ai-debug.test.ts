import { aiDebug, aiDebugEnabled } from '@kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('opt-in AI debug log (localStorage cui.debug.ai)', () => {
  let info: ReturnType<typeof vi.spyOn>;
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    });
    info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });
  afterEach(() => {
    info.mockRestore();
    vi.unstubAllGlobals();
  });

  it('is off by default and logs nothing', () => {
    expect(aiDebugEnabled()).toBe(false);
    aiDebug('extract raw', 'text');
    expect(info).not.toHaveBeenCalled();
  });

  it('is off for any value other than "1"', () => {
    for (const v of ['0', 'true', '', 'yes']) {
      store['cui.debug.ai'] = v;
      aiDebug('x');
    }
    expect(info).not.toHaveBeenCalled();
  });

  it('logs with the [ConformUI AI] prefix when the key is "1"', () => {
    store['cui.debug.ai'] = '1';
    expect(aiDebugEnabled()).toBe(true);
    aiDebug('extract raw', { a: 1 });
    expect(info).toHaveBeenCalledWith('[ConformUI AI]', 'extract raw', { a: 1 });
  });

  it('is off, not an error, when storage throws or is missing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(aiDebugEnabled()).toBe(false);
    expect(() => aiDebug('x')).not.toThrow();
    vi.stubGlobal('localStorage', undefined);
    expect(aiDebugEnabled()).toBe(false);
  });
});
