import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import '../../../src/app/zod-jitless';

describe('zod-jitless', () => {
  it('SPEC-SEC-01, S22: importing the side-effect module turns zod jitless so no new Function is needed', () => {
    expect(z.config().jitless).toBe(true);
  });
});
