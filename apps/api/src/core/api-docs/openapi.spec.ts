import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOpenApi, renderMarkdown } from './openapi';

/**
 * BACKLOG QA-04: dokumentace API v docs/api/ musí odpovídat kódu.
 * Po změně endpointů / DTO: `UPDATE_API_DOCS=1 npx jest src/core/api-docs`.
 */
const SRC = join(__dirname, '../..');
const OUT = join(__dirname, '../../../../../docs/api');

describe('QA-04 dokumentace API', () => {
  const doc = buildOpenApi(SRC);
  const json = JSON.stringify(doc, null, 2) + '\n';
  const md = renderMarkdown(doc) + '\n';

  if (process.env.UPDATE_API_DOCS === '1') {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'openapi.json'), json);
    writeFileSync(join(OUT, 'README.md'), md);
  }

  it('obsahuje hlavní průchod MVP', () => {
    const paths = Object.keys(doc.paths);
    expect(paths.length).toBeGreaterThan(100);
    for (const p of [
      '/api/v1/auth/login',
      '/api/v1/assets',
      '/api/v1/assets/{id}/movements',
      '/api/v1/assets/attention',
    ])
      expect(paths).toContain(p);
    expect(doc.paths['/api/v1/assets']?.post?.['x-permission']).toBe('asset.item.create');
  });

  it('docs/api je aktuální (jinak UPDATE_API_DOCS=1 npx jest src/core/api-docs)', () => {
    expect(existsSync(join(OUT, 'openapi.json'))).toBe(true);
    expect(readFileSync(join(OUT, 'openapi.json'), 'utf8')).toBe(json);
    expect(readFileSync(join(OUT, 'README.md'), 'utf8')).toBe(md);
  });
});
