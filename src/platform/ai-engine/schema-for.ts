import type { AiTask } from '@kernel';
import { DeepOutputSchema, ExtractOutputSchema, InferOutputSchema, JudgeOutputSchema } from '@kernel';
import { Schema } from 'firebase/ai';

// SPEC-AI-05: one mapper. zod -> JSON Schema (draft-7, output side) -> normalised once -> device schema as is,
// cloud Firebase `Schema` built from the same normalised tree. Length limits (maxLength) stay on the device schema
// only; zod re-checks every limit after the call, so it remains the authority.
// SPEC-AI-05 verified (pending spike 4.3, A6): on-device acceptance of each task's JSON Schema.

type Json = { [k: string]: unknown };

function unsupported(what: string): never {
  throw new Error(`schemaFor: unsupported schema construct (${what})`);
}

/** Tuples become uniform arrays (neither target models tuples); `$schema` is dropped. */
function normalise(node: unknown): Json {
  const n = { ...(node as Json) };
  delete n.$schema;
  if (n.properties) {
    n.properties = Object.fromEntries(Object.entries(n.properties as Json).map(([k, v]) => [k, normalise(v)]));
  }
  if (Array.isArray(n.items)) {
    const items = (n.items as unknown[]).map(normalise);
    if (items.some((i) => JSON.stringify(i) !== JSON.stringify(items[0]))) unsupported('heterogeneous tuple');
    n.items = items[0];
    delete n.additionalItems;
  } else if (n.items) {
    n.items = normalise(n.items);
  }
  return n;
}

function toCloud(node: Json, forceNullable = false): Schema {
  const any = node.anyOf as Json[] | undefined;
  if (Array.isArray(any)) {
    const rest = any.filter((a) => a.type !== 'null');
    if (rest.length === 1 && rest.length !== any.length) return toCloud(rest[0] as Json, true);
  }
  let type = node.type;
  let nullable = forceNullable;
  if (Array.isArray(type)) {
    const rest = type.filter((t) => t !== 'null');
    if (rest.length !== 1) unsupported('type union');
    nullable = nullable || rest.length !== type.length;
    type = rest[0];
  }
  const p: { nullable?: boolean; minItems?: number; maxItems?: number; minimum?: number; maximum?: number } = {};
  if (nullable) p.nullable = true;
  if (typeof node.minItems === 'number') p.minItems = node.minItems;
  if (typeof node.maxItems === 'number') p.maxItems = node.maxItems;
  if (typeof node.minimum === 'number') p.minimum = node.minimum;
  if (typeof node.maximum === 'number') p.maximum = node.maximum;
  if (node.anyOf || node.oneOf || node.allOf || node.$ref) unsupported('union or reference');

  switch (type) {
    case 'object': {
      const props = (node.properties ?? {}) as Json;
      const required = new Set((node.required ?? []) as string[]);
      return Schema.object({
        ...p,
        properties: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, toCloud(v as Json)])),
        optionalProperties: Object.keys(props).filter((k) => !required.has(k)),
      });
    }
    case 'array':
      if (!node.items) unsupported('array without items');
      return Schema.array({ ...p, items: toCloud(node.items as Json) });
    case 'string':
      return Array.isArray(node.enum) ? Schema.enumString({ ...p, enum: node.enum as string[] }) : Schema.string(p);
    case 'integer':
      return Schema.integer(p);
    case 'number':
      return Schema.number(p);
    case 'boolean':
      return Schema.boolean(p);
    default:
      return unsupported(String(type));
  }
}

/** Structural view of a kernel zod schema (platform may not import zod; the instance method is enough). */
export interface JsonSchemaSource {
  toJSONSchema(params: { target: 'draft-7'; io: 'output' }): unknown;
}

export function zodToSchemas(schema: JsonSchemaSource): { cloud: Schema; device: object } {
  const device = normalise(schema.toJSONSchema({ target: 'draft-7', io: 'output' }));
  return { cloud: toCloud(device), device };
}

const OUTPUT_SCHEMAS = {
  'extract-contract': ExtractOutputSchema,
  'infer-responsive': InferOutputSchema,
  judge: JudgeOutputSchema,
  'deep-analysis': DeepOutputSchema,
} as const;

/** SPEC-AI-06: the kernel zod schema a task output is re-checked with (structural view; no zod import in platform). */
export function outputSchemaFor(task: AiTask): {
  safeParse(v: unknown): { success: true; data: unknown } | { success: false };
} {
  const schema = OUTPUT_SCHEMAS[task];
  if (!schema) throw new Error(`outputSchemaFor: unknown task ${String(task)}`);
  return schema;
}

/** Implementation of the public `schemaFor` (kept here so model-factory does not import the package index). */
export function schemaForTask(task: AiTask): { cloud: Schema; device: object } {
  const schema = OUTPUT_SCHEMAS[task];
  if (!schema) throw new Error(`schemaFor: unknown task ${String(task)}`);
  return zodToSchemas(schema);
}
