import type { z } from 'zod';

type JsonSchema = Record<string, unknown>;

interface ZodDefLike {
  typeName: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Minimální převod Zod → JSON Schema pro vstupy akcí (MCP `inputSchema`).
 * Podporuje jen typy, které akce používají (object, string, number, boolean,
 * enum, optional, default); neznámý typ = `{}` (bez omezení), ne pád.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  const def = (schema as unknown as { _def: ZodDefLike })._def;
  const withDescription = (out: JsonSchema): JsonSchema =>
    def.description ? { ...out, description: def.description } : out;

  switch (def.typeName) {
    case 'ZodObject': {
      const shape = (schema as z.AnyZodObject).shape as Record<string, z.ZodTypeAny>;
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value);
        if (!value.isOptional()) required.push(key);
      }
      return withDescription({
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false,
      });
    }
    case 'ZodString': {
      const out: JsonSchema = { type: 'string' };
      for (const check of (def.checks as { kind: string; value?: number }[]) ?? []) {
        if (check.kind === 'min') out.minLength = check.value;
        if (check.kind === 'max') out.maxLength = check.value;
        if (check.kind === 'uuid') out.format = 'uuid';
      }
      return withDescription(out);
    }
    case 'ZodNumber': {
      const out: JsonSchema = { type: 'number' };
      for (const check of (def.checks as { kind: string; value?: number }[]) ?? []) {
        if (check.kind === 'int') out.type = 'integer';
        if (check.kind === 'min') out.minimum = check.value;
        if (check.kind === 'max') out.maximum = check.value;
      }
      return withDescription(out);
    }
    case 'ZodBoolean':
      return withDescription({ type: 'boolean' });
    case 'ZodEnum':
      return withDescription({ type: 'string', enum: [...(def.values as string[])] });
    case 'ZodOptional':
    case 'ZodNullable':
      return withDescription(zodToJsonSchema(def.innerType as z.ZodTypeAny));
    case 'ZodDefault':
      return withDescription({
        ...zodToJsonSchema(def.innerType as z.ZodTypeAny),
        default: (def.defaultValue as () => unknown)(),
      });
    default:
      return withDescription({});
  }
}
