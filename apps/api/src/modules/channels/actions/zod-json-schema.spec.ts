import { z } from 'zod';
import { zodToJsonSchema } from './zod-json-schema';

describe('zodToJsonSchema', () => {
  it('převede objekt s povinnými a nepovinnými poli', () => {
    const schema = z.object({
      query: z.string().min(1).max(200).describe('Search text'),
      assetId: z.string().uuid(),
      limit: z.number().int().min(1).max(20).optional(),
      kind: z.enum(['damage', 'other']).default('other'),
      all: z.boolean().optional(),
    });
    expect(zodToJsonSchema(schema)).toEqual({
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 200, description: 'Search text' },
        assetId: { type: 'string', format: 'uuid' },
        limit: { type: 'integer', minimum: 1, maximum: 20 },
        kind: { type: 'string', enum: ['damage', 'other'], default: 'other' },
        all: { type: 'boolean' },
      },
      required: ['query', 'assetId'],
      additionalProperties: false,
    });
  });

  it('prázdný objekt nemá required', () => {
    expect(zodToJsonSchema(z.object({}))).toEqual({
      type: 'object',
      properties: {},
      additionalProperties: false,
    });
  });
});
