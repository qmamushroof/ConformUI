import { describe, expect, it } from 'vitest';
import { regionDisplay, rowFields } from '../../../src/features/contract/display';
import { rect, requirement } from '../../helpers/samples';

describe('SPEC-CON-07: region display data', () => {
  it('SPEC-CON-07: a snapped, user or sample region is outlined solid', () => {
    for (const source of ['snapped', 'user', 'sample'] as const) {
      expect(regionDisplay(requirement({ region: { rect: rect(), source } }))).toEqual({
        kind: 'outlined',
        rect: rect(),
        dashed: false,
        source,
      });
    }
  });

  it('SPEC-CON-07: an unresolved region is dashed at the suggested rect with the exact note', () => {
    const suggested = rect({ x: 5 });
    expect(regionDisplay(requirement({ region: { unresolved: true, suggested } }))).toEqual({
      kind: 'outlined',
      rect: suggested,
      dashed: true,
      note: 'Region not found: image checks need review',
    });
  });

  it('SPEC-CON-07: no region -> nothing to draw', () => {
    const r = { ...requirement() };
    delete r.region;
    expect(regionDisplay(r)).toEqual({ kind: 'none' });
  });
});

describe('SPEC-CON-08: Requirement row fields', () => {
  it('SPEC-CON-08: explicit AI row carries id, viewport, category, label, check type, texts and the engine badge', () => {
    const f = rowFields(requirement({ engine: 'on-device' }));
    expect(f).toMatchObject({
      id: 'R-01',
      viewport: 'desktop',
      category: 'size',
      label: { text: 'Explicit', advisory: false },
      checkType: 'measured',
      statement: 'Primary CTA is 220 px wide',
      condition: 'CTA width within 8% of 220 px',
      badge: 'On-device',
    });
    expect(rowFields(requirement({ engine: 'cloud' })).badge).toBe('Cloud');
  });

  it('SPEC-CON-08, SPEC-UI-04: Inferred label text is "Inferred (advisory)"', () => {
    expect(rowFields(requirement({ label: 'inferred', origin: 'rule' })).label).toEqual({
      text: 'Inferred (advisory)',
      advisory: true,
    });
  });

  it('SPEC-CON-08: badge by origin: user "Added by you", rule "Rule", sample "Sample (verified)", precomputed "Pre-computed"', () => {
    expect(rowFields(requirement({ origin: 'user' })).badge).toBe('Added by you');
    expect(rowFields(requirement({ origin: 'rule' })).badge).toBe('Rule');
    expect(rowFields(requirement({ origin: 'sample' })).badge).toBe('Sample (verified)');
    expect(rowFields(requirement({ origin: 'precomputed' })).badge).toBe('Pre-computed');
  });

  it('SPEC-CON-08: an AI row without an engine still shows a badge text', () => {
    const r = { ...requirement({ origin: 'ai' }) };
    delete r.engine;
    expect(rowFields(r).badge).toBe('AI');
  });
});
