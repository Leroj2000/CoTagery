import 'reflect-metadata';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import {
  ALLOW_AUTHENTICATED_ONLY_KEY,
  REQUIRE_PERMISSION_KEY,
} from '../rbac/require-permission.decorator';
import { REQUIRE_MODULE_KEY } from '../rbac/require-module.decorator';

/**
 * Generátor OpenAPI 3.1 popisu API (BACKLOG QA-04) bez bootu aplikace a bez
 * závislosti na @nestjs/swagger: čte metadata Nestu (controllery, routy,
 * parametry), class-validator (DTO těl) a RBAC dekorátory (oprávnění, modul).
 * Volá se jen z testu `openapi.spec.ts`, který hlídá aktuálnost docs/api/.
 */
const HTTP = ['get', 'post', 'put', 'delete', 'patch', 'all', 'options', 'head', 'search'];
const CONTROLLER_WATERMARK = '__controller__';
/** Routy vyjmuté z globálního prefixu api/v1 (viz main.ts). */
const ROOT_PATHS = [/^r\//, /^mcp$/, /^\.well-known\//, /^oauth\/(register|token|revoke)$/];
// RouteParamtypes z @nestjs/common
const BODY = 3;
const QUERY = 4;

type Schema = Record<string, unknown>;
export interface OpenApiDoc {
  openapi: string;
  info: Record<string, unknown>;
  servers: { url: string; description: string }[];
  components: Record<string, unknown>;
  tags: { name: string; description?: string }[];
  paths: Record<string, Record<string, Schema>>;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const VALIDATOR_TYPES: Record<string, Schema> = {
  isString: { type: 'string' },
  isNotEmpty: {},
  isUUID: { type: 'string', format: 'uuid' },
  isEmail: { type: 'string', format: 'email' },
  isUrl: { type: 'string', format: 'uri' },
  isDateString: { type: 'string', format: 'date-time' },
  isISO8601: { type: 'string', format: 'date-time' },
  isDate: { type: 'string', format: 'date-time' },
  isInt: { type: 'integer' },
  isNumber: { type: 'number' },
  isNumberString: { type: 'string', pattern: '^[0-9.]+$' },
  isBoolean: { type: 'boolean' },
  isArray: { type: 'array' },
  isObject: { type: 'object' },
  isHexColor: { type: 'string', pattern: '^#?[0-9a-fA-F]{3,8}$' },
};

/** Schéma DTO z class-validator metadat (jen ploché vlastnosti, bez rekurze). */
export function dtoSchema(cls: unknown): Schema | undefined {
  if (typeof cls !== 'function' || [String, Number, Boolean, Object, Array].includes(cls as never))
    return undefined;
  const metas = getMetadataStorage().getTargetValidationMetadatas(
    cls as new () => unknown,
    '',
    true,
    false,
  );
  if (!metas.length) return { type: 'object', title: (cls as { name: string }).name };
  const props: Record<string, Schema> = {};
  const optional = new Set<string>();
  for (const m of metas) {
    const p = m.propertyName;
    const s = (props[p] ??= {});
    const name = m.name ?? '';
    if (m.type === 'conditionalValidation') optional.add(p);
    if (m.type === 'nestedValidation') s.type = m.each ? 'array' : 'object';
    const t = VALIDATOR_TYPES[name];
    if (t) {
      if (m.each && t.type) s.items = { ...t };
      else Object.assign(s, t);
      if (m.each) s.type = 'array';
    }
    const c = m.constraints ?? [];
    if (name === 'isIn' && Array.isArray(c[0])) s.enum = c[0];
    if (name === 'isEnum' && c[0] && typeof c[0] === 'object') s.enum = Object.values(c[0]);
    if (name === 'maxLength') s.maxLength = c[0];
    if (name === 'minLength') s.minLength = c[0];
    if (name === 'max') s.maximum = c[0];
    if (name === 'min') s.minimum = c[0];
    if (name === 'arrayMaxSize') s.maxItems = c[0];
  }
  const required = Object.keys(props).filter((p) => !optional.has(p)).sort();
  return {
    type: 'object',
    title: (cls as { name: string }).name,
    properties: Object.fromEntries(Object.entries(props).sort(([a], [b]) => a.localeCompare(b))),
    ...(required.length ? { required } : {}),
  };
}

function joinPath(base: string, path: string): string {
  return [base, path]
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function tagOf(file: string): string {
  const parts = file.split('/');
  return parts[parts.length - 2] ?? 'api';
}

export function buildOpenApi(srcDir: string): OpenApiDoc {
  const paths: OpenApiDoc['paths'] = {};
  const tags = new Set<string>();
  for (const file of walk(srcDir).filter((f) => f.endsWith('.controller.ts'))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file) as Record<string, unknown>;
    for (const value of Object.values(mod)) {
      if (typeof value !== 'function' || !Reflect.getMetadata(CONTROLLER_WATERMARK, value)) continue;
      const cls = value as new (...args: never[]) => unknown;
      const rel = relative(srcDir, file);
      const tag = tagOf(rel);
      tags.add(tag);
      const bases = [Reflect.getMetadata(PATH_METADATA, cls) ?? ''].flat() as string[];
      const classPerm = Reflect.getMetadata(REQUIRE_PERMISSION_KEY, cls) as string | undefined;
      const classAllow = Reflect.getMetadata(ALLOW_AUTHENTICATED_ONLY_KEY, cls) as boolean | undefined;
      const classModule = Reflect.getMetadata(REQUIRE_MODULE_KEY, cls) as string | string[] | undefined;
      const proto = cls.prototype as Record<string, unknown>;
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === 'constructor') continue;
        const handler = proto[key];
        if (typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
        const rpaths = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
        if (method === undefined || rpaths === undefined) continue;
        const perm = (Reflect.getMetadata(REQUIRE_PERMISSION_KEY, handler) as string | undefined) ?? classPerm;
        const allow = (Reflect.getMetadata(ALLOW_AUTHENTICATED_ONLY_KEY, handler) as boolean | undefined) ?? classAllow;
        const moduleKey = (Reflect.getMetadata(REQUIRE_MODULE_KEY, handler) as string | string[] | undefined) ?? classModule;
        const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, cls, key) ?? {}) as Record<
          string,
          { index: number; data?: unknown }
        >;
        const paramTypes = (Reflect.getMetadata('design:paramtypes', proto, key) ?? []) as unknown[];
        const parameters: Schema[] = [];
        let body: Schema | undefined;
        for (const [k, a] of Object.entries(args)) {
          const type = Number(k.split(':')[0]);
          if (type === QUERY) {
            if (typeof a.data === 'string')
              parameters.push({ name: a.data, in: 'query', required: false, schema: { type: 'string' } });
            else {
              const s = dtoSchema(paramTypes[a.index]);
              for (const [name, ps] of Object.entries((s?.properties ?? {}) as Record<string, Schema>))
                parameters.push({ name, in: 'query', required: false, schema: ps });
            }
          }
          if (type === BODY) body = dtoSchema(paramTypes[a.index]) ?? { type: 'object' };
        }
        for (const base of bases)
          for (const rp of [rpaths].flat()) {
            const raw = joinPath(base, rp);
            const isRoot = ROOT_PATHS.some((r) => r.test(raw));
            const full = '/' + (isRoot ? raw : joinPath('api/v1', raw));
            const oaPath = full.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
            const pathParams = [...full.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => ({
              name: m[1],
              in: 'path',
              required: true,
              schema: { type: 'string' },
            }));
            const access = perm
              ? `Oprávnění \`${perm}\``
              : allow
                ? 'Každý přihlášený člen firmy'
                : 'Bez členského oprávnění (veřejné / vlastní ověření – viz controller)';
            const op: Schema = {
              tags: [tag],
              operationId: `${cls.name}.${key}`,
              summary: `${cls.name}.${key}`,
              description: access + (moduleKey ? ` · modul \`${[moduleKey].flat().join(', ')}\`` : ''),
              ...(perm ? { 'x-permission': perm } : {}),
              ...(moduleKey ? { 'x-module': [moduleKey].flat() } : {}),
              ...(perm || allow ? { security: [{ bearer: [] }] } : {}),
              parameters: [...pathParams, ...parameters.sort((a, b) => String(a.name).localeCompare(String(b.name)))],
              ...(body && !['get', 'delete'].includes(HTTP[method] ?? '')
                ? { requestBody: { required: true, content: { 'application/json': { schema: body } } } }
                : {}),
              responses: { default: { description: 'Viz implementace controlleru' } },
              'x-source': rel,
            };
            (paths[oaPath] ??= {})[HTTP[method] ?? String(method)] = op;
          }
      }
    }
  }
  const sorted = Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)));
  return {
    openapi: '3.1.0',
    info: {
      title: 'Tagery API',
      version: 'v1',
      description:
        'Generováno z kódu (apps/api/src/core/api-docs/openapi.ts, BACKLOG QA-04). ' +
        'Autentizace: POST /api/v1/auth/login → accessToken (Bearer JWT, 15 min) + refresh. ' +
        'Data jsou vždy v kontextu aktivní firmy z tokenu (RLS). Web volá API přes BFF (/api/*) s httpOnly cookie.',
    },
    servers: [{ url: 'https://app.tagery.tech', description: 'produkce' }],
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    tags: [...tags].sort().map((name) => ({ name })),
    paths: sorted,
  };
}

/** Markdown přehled endpointů pro lidi. */
export function renderMarkdown(doc: OpenApiDoc): string {
  const rows: Record<string, string[]> = {};
  let count = 0;
  for (const [path, ops] of Object.entries(doc.paths))
    for (const [method, op] of Object.entries(ops)) {
      const tag = (op.tags as string[])[0];
      const perm = (op['x-permission'] as string | undefined) ?? (op.security ? 'přihlášený' : 'veřejné / vlastní');
      const mod = (op['x-module'] as string[] | undefined)?.join(', ') ?? '';
      (rows[tag] ??= []).push(`| ${method.toUpperCase()} | \`${path}\` | ${perm} | ${mod} | ${op.operationId as string} |`);
      count++;
    }
  const out = [
    '# Tagery API – přehled endpointů',
    '',
    '> Generováno z kódu – needitovat ručně. Aktualizace: `cd apps/api && UPDATE_API_DOCS=1 npx jest src/core/api-docs`.',
    '> Strojově čitelná specifikace: [`openapi.json`](./openapi.json) (OpenAPI 3.1, těla z class-validator DTO).',
    '',
    '- Základ: `https://app.tagery.tech/api/v1` (výjimky na kořeni: `/r/*`, `/mcp`, `/oauth/*`, `/.well-known/*`).',
    '- Přihlášení: `POST /api/v1/auth/login` `{ email, password }` → `accessToken` (Bearer, 15 min) + `refreshToken` → `POST /api/v1/auth/refresh`.',
    '- Autorizace: sloupec *Oprávnění* = klíč z katalogu rolí (`Nastavení → Role`); *přihlášený* = stačí členství ve firmě.',
    '- Data se vždy vztahují k aktivní firmě z tokenu (Row Level Security).',
    '',
    `Celkem ${count} endpointů.`,
    '',
  ];
  for (const tag of Object.keys(rows).sort()) {
    out.push(`## ${tag}`, '', '| Metoda | Cesta | Oprávnění | Modul | Handler |', '|---|---|---|---|---|', ...rows[tag], '');
  }
  return out.join('\n');
}
