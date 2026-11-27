import type { AiTask } from '@kernel';
import { CategorySchema, DeepOutputSchema, EXTRACT_CHECK_KINDS, InferOutputSchema, JudgeOutputSchema } from '@kernel';
import { Schema } from 'firebase/ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { schemaFor } from '../../../src/platform/ai-engine';
import { zodToSchemas } from '../../../src/platform/ai-engine/schema-for';

// biome-ignore lint/suspicious/noExplicitAny: walking untyped schema JSON in assertions
type J = any;
const cloudJson = (t: AiTask): J => JSON.parse(JSON.stringify(schemaFor(t).cloud));
const TASKS: AiTask[] = ['extract-contract', 'infer-responsive', 'judge', 'deep-analysis'];

describe('SPEC-AI-05: schemaFor round trip for all four tasks', () => {
  it.each(TASKS)('SPEC-AI-05: %s yields a Firebase Schema and a plain JSON Schema object', (task) => {
    const { cloud, device } = schemaFor(task);
    expect(cloud).toBeInstanceOf(Schema);
    expect(cloudJson(task).type).toBe('object');
    expect((device as J).type).toBe('object');
    expect(() => JSON.stringify(device)).not.toThrow();
  });

  it('SPEC-AI-05: device schema has no $schema key and survives a JSON round trip unchanged', () => {
    for (const t of TASKS) {
      const d = schemaFor(t).device;
      expect(d).not.toHaveProperty('$schema');
      expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    }
  });

  it('SPEC-AI-05: unknown task throws', () => {
    expect(() => schemaFor('nope' as AiTask)).toThrow();
  });

  it('SPEC-AI-05: required keys match zod for judge (cloud and device)', () => {
    const required = ['verdict', 'confidence', 'explanation', 'suggestedFix'];
    expect([...cloudJson('judge').required].sort()).toEqual([...required].sort());
    expect([...(schemaFor('judge').device as J).required].sort()).toEqual([...required].sort());
  });

  it('SPEC-AI-05: enums are carried exactly (judge, extract, infer, deep)', () => {
    const j = cloudJson('judge').properties;
    expect(j.verdict.enum).toEqual(JudgeOutputSchema.shape.verdict.options);
    expect(j.confidence.enum).toEqual(['high', 'medium', 'low']);
    const req = cloudJson('extract-contract').properties.requirements.items.properties;
    expect(req.checkKind.enum).toEqual([...EXTRACT_CHECK_KINDS]);
    expect(req.category.enum).toEqual(CategorySchema.options);
    const inf = cloudJson('infer-responsive').properties.items.items.properties;
    expect(inf.checkKind.enum).toEqual(['visible', 'presence', 'dominant-text']);
    const deep = cloudJson('deep-analysis').properties.items.items.properties;
    expect(deep.status.enum).toEqual(['fail', 'pass', 'needs-review']);
    expect((schemaFor('judge').device as J).properties.verdict.enum).toEqual(['pass', 'fail', 'uncertain']);
  });

  it('SPEC-AI-05: optional keys are not required (extract, deep)', () => {
    const req = cloudJson('extract-contract').properties.requirements.items;
    expect(req.required).toEqual(
      expect.arrayContaining(['category', 'statement', 'condition', 'checkKind', 'box_2d', 'matchHint']),
    );
    for (const k of ['expectedText', 'expectedCount', 'primary']) {
      expect(req.required).not.toContain(k);
      expect(req.properties[k]).toBeDefined();
    }
    expect(req.properties.matchHint.required ?? []).toEqual([]);
    const deep = cloudJson('deep-analysis').properties.items.items;
    expect(deep.required).not.toContain('crossViewportCause');
    expect(deep.properties.crossViewportCause.type).toBe('string');
    const dev = (schemaFor('deep-analysis').device as J).properties.items.items;
    expect(dev.required).not.toContain('crossViewportCause');
  });

  it('SPEC-AI-05: arrays carry items and max bounds (extract 8, infer 6, deep unbounded)', () => {
    expect(cloudJson('extract-contract').properties.requirements.maxItems).toBe(8);
    expect(cloudJson('infer-responsive').properties.items.maxItems).toBe(6);
    expect(cloudJson('deep-analysis').properties.items.maxItems).toBeUndefined();
    expect(cloudJson('deep-analysis').properties.items.type).toBe('array');
    expect((schemaFor('extract-contract').device as J).properties.requirements.maxItems).toBe(8);
  });

  it('SPEC-AI-05: the box tuple becomes a bounded array of four numbers in both targets', () => {
    const box = cloudJson('extract-contract').properties.requirements.items.properties.box_2d;
    expect(box.type).toBe('array');
    expect(box.items.type).toBe('number');
    expect([box.minItems, box.maxItems]).toEqual([4, 4]);
    expect([box.items.minimum, box.items.maximum]).toEqual([0, 4096]);
    const dbox = (schemaFor('extract-contract').device as J).properties.requirements.items.properties.box_2d;
    expect(dbox.type).toBe('array');
    expect(Array.isArray(dbox.items)).toBe(false);
    expect([dbox.minItems, dbox.maxItems]).toEqual([4, 4]);
  });

  it('SPEC-AI-05: cloud schema has no unsupported keys ($schema, additionalProperties, maxLength, type arrays)', () => {
    for (const t of TASKS) {
      expect(JSON.stringify(schemaFor(t).cloud)).not.toMatch(/\$schema|additionalProperties|maxLength|"type":\[/);
    }
  });

  it('SPEC-AI-05: device schema keeps length limits and forbids extra keys', () => {
    const d = schemaFor('judge').device as J;
    expect(d.properties.explanation.maxLength).toBe(300);
    expect(d.properties.suggestedFix.maxLength).toBe(200);
    expect(d.additionalProperties).toBe(false);
  });

  it('SPEC-AI-05: zod stays the authority for limits the cloud schema drops', () => {
    expect(
      JudgeOutputSchema.safeParse({
        verdict: 'pass',
        confidence: 'high',
        explanation: 'x'.repeat(301),
        suggestedFix: '',
      }).success,
    ).toBe(false);
    expect(DeepOutputSchema.safeParse({ items: [] }).success).toBe(true);
    expect(InferOutputSchema.safeParse({ items: [] }).success).toBe(true);
  });
});

describe('SPEC-AI-05: mapper edge cases (nullable, nesting, numbers)', () => {
  it('SPEC-AI-05: nullable string maps to nullable:true on cloud and a null type on device', () => {
    const { cloud, device } = zodToSchemas(z.object({ a: z.string().nullable(), b: z.string() }));
    const c = JSON.parse(JSON.stringify(cloud));
    expect(c.properties.a.nullable).toBe(true);
    expect(c.properties.a.type).toBe('string');
    expect(c.properties.b.nullable).toBeFalsy();
    expect(c.required).toEqual(['a', 'b']);
    expect((device as J).properties.a.type).toEqual(['string', 'null']);
  });

  it('SPEC-AI-05: optional and nullable together is nullable but not required', () => {
    const c = JSON.parse(
      JSON.stringify(zodToSchemas(z.object({ a: z.number().nullable().optional(), k: z.boolean() })).cloud),
    );
    expect(c.required).toEqual(['k']);
    expect(c.properties.a.nullable).toBe(true);
    expect(c.properties.a.type).toBe('number');
    expect(c.properties.k.type).toBe('boolean');
  });

  it('SPEC-AI-05: nullable enum and nullable array keep their inner shape', () => {
    const c = JSON.parse(
      JSON.stringify(
        zodToSchemas(z.object({ e: z.enum(['x', 'y']).nullable(), l: z.array(z.string()).nullable() })).cloud,
      ),
    );
    expect(c.properties.e).toMatchObject({ type: 'string', enum: ['x', 'y'], nullable: true });
    expect(c.properties.l).toMatchObject({ type: 'array', nullable: true });
    expect(c.properties.l.items.type).toBe('string');
  });

  it('SPEC-AI-05: integers map to INTEGER and an empty object maps to an object', () => {
    const c = JSON.parse(JSON.stringify(zodToSchemas(z.object({ n: z.int(), o: z.object({}) })).cloud));
    expect(c.properties.n.type).toBe('integer');
    expect(c.properties.o.type).toBe('object');
  });

  it('SPEC-AI-05: an unsupported construct throws instead of silently loosening', () => {
    expect(() => zodToSchemas(z.object({ u: z.union([z.string(), z.number()]) }))).toThrow(/unsupported/i);
  });
});
