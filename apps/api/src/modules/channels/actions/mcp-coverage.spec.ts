import 'reflect-metadata';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { REQUIRE_PERMISSION_KEY } from '../../../core/rbac/require-permission.decorator';
import { ActionRegistry } from './action-registry.service';
import { MCP_CONTROLLER_COVERAGE, MCP_PERMISSION_COVERAGE, type McpDecision } from './mcp-coverage';
import { V1ActionsProvider } from './v1.actions';

/**
 * Kontrola pokrytí MCP (EPIC-22): každé oprávnění a každý API controller musí mít
 * výslovné rozhodnutí v `mcp-coverage.ts` – pokrytí akcí, nebo důvod vyloučení.
 * Aplikace se nebootuje: oprávnění se čtou z migrací katalogu a z metadat
 * `@RequirePermission`, controllery z metadat Nestu po importu `*.controller.ts`.
 */
const SRC = join(__dirname, '../../..');
const MANIFEST = 'apps/api/src/modules/channels/actions/mcp-coverage.ts';
const CONTROLLER_WATERMARK = '__controller__';
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Klíče z migrací, které vkládají do katalogu `permissions`. */
function catalogPermissionKeys(): Set<string> {
  const keys = new Set<string>();
  const dir = join(SRC, 'database/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(dir, file), 'utf8');
    if (!/INSERT INTO\s+"?permissions"?/i.test(src)) continue;
    for (const m of src.matchAll(/'([a-z_]+\.[a-z_]+\.[a-z_]+)'/g)) keys.add(m[1]);
  }
  return keys;
}

interface ControllerInfo {
  name: string;
  file: string;
  routes: string[];
  permissions: string[];
}

function discoverControllers(): ControllerInfo[] {
  const files = walk(SRC).filter((f) => f.endsWith('.controller.ts'));
  const out: ControllerInfo[] = [];
  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file) as Record<string, unknown>;
    for (const value of Object.values(mod)) {
      if (typeof value !== 'function' || !Reflect.getMetadata(CONTROLLER_WATERMARK, value))
        continue;
      const cls = value as new (...args: never[]) => unknown;
      const base = String(Reflect.getMetadata(PATH_METADATA, cls) ?? '');
      const routes: string[] = [];
      const permissions = new Set<string>();
      const classPerm = Reflect.getMetadata(REQUIRE_PERMISSION_KEY, cls) as string | undefined;
      if (classPerm) permissions.add(classPerm);
      for (const key of Object.getOwnPropertyNames(cls.prototype)) {
        if (key === 'constructor') continue;
        const handler = (cls.prototype as Record<string, unknown>)[key];
        if (typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
        const path = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
        if (method === undefined || path === undefined) continue;
        routes.push(
          `${HTTP_METHODS[method] ?? method} /${[base, String(path)].filter((p) => p && p !== '/').join('/')}`,
        );
        const perm = Reflect.getMetadata(REQUIRE_PERMISSION_KEY, handler) as string | undefined;
        if (perm) permissions.add(perm);
      }
      out.push({
        name: cls.name,
        file: relative(SRC, file),
        routes,
        permissions: [...permissions],
      });
    }
  }
  return out;
}

const registry = new ActionRegistry(
  new V1ActionsProvider(
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  ),
);
const actionKeys = new Set(registry.list().map((a) => a.key));

function unknownActions(manifest: Record<string, McpDecision>): string[] {
  return Object.entries(manifest).flatMap(([key, d]) =>
    'actions' in d ? d.actions.filter((a) => !actionKeys.has(a)).map((a) => `${key} → ${a}`) : [],
  );
}

function hint(kind: string, items: string[]): string {
  return (
    `${kind} bez rozhodnutí o MCP:\n  - ${items.join('\n  - ')}\n` +
    `Doplň je do ${MANIFEST} jako { actions: ['…'] } nebo { excluded: 'důvod' } ` +
    `(viz AGENTS.md, pravidlo o MCP manifestu).`
  );
}

describe('Pokrytí MCP (mcp-coverage.ts)', () => {
  const controllers = discoverControllers();
  const permissions = new Set([
    ...catalogPermissionKeys(),
    ...controllers.flatMap((c) => c.permissions),
  ]);

  it('najde katalog oprávnění i controllery', () => {
    expect(permissions.size).toBeGreaterThan(40);
    expect(controllers.length).toBeGreaterThan(50);
    expect(actionKeys.size).toBeGreaterThanOrEqual(8);
  });

  it('každé oprávnění má rozhodnutí', () => {
    const missing = [...permissions].filter((p) => !(p in MCP_PERMISSION_COVERAGE)).sort();
    if (missing.length) throw new Error(hint('Oprávnění', missing));
  });

  it('každý controller má rozhodnutí', () => {
    const missing = controllers
      .filter((c) => !(c.name in MCP_CONTROLLER_COVERAGE))
      .map((c) => `${c.name} (${c.file}; ${c.routes.join(', ') || 'bez rout'})`);
    if (missing.length) throw new Error(hint('Controllery', missing));
  });

  it('manifest neobsahuje zastaralé záznamy', () => {
    const names = new Set(controllers.map((c) => c.name));
    const stale = [
      ...Object.keys(MCP_PERMISSION_COVERAGE).filter((p) => !permissions.has(p)),
      ...Object.keys(MCP_CONTROLLER_COVERAGE).filter((c) => !names.has(c)),
    ];
    if (stale.length) {
      throw new Error(
        `Záznamy v ${MANIFEST} pro neexistující oprávnění/controllery: ${stale.join(', ')}`,
      );
    }
  });

  it('odkazované akce existují v ActionRegistry', () => {
    const bad = [
      ...unknownActions(MCP_PERMISSION_COVERAGE),
      ...unknownActions(MCP_CONTROLLER_COVERAGE),
    ];
    if (bad.length) throw new Error(`Neexistující akce v ${MANIFEST}: ${bad.join(', ')}`);
  });

  it('každá akce je v manifestu u svého oprávnění', () => {
    const bad = registry
      .list()
      .filter((a) => a.permission)
      .filter((a) => {
        const d = MCP_PERMISSION_COVERAGE[a.permission!];
        return !d || !('actions' in d) || !d.actions.includes(a.key);
      })
      .map((a) => `${a.key} (${a.permission})`);
    if (bad.length) {
      throw new Error(`Akce chybí u svého oprávnění v ${MANIFEST}: ${bad.join(', ')}`);
    }
  });

  it('důvody vyloučení nejsou prázdné', () => {
    const empty = [
      ...Object.entries(MCP_PERMISSION_COVERAGE),
      ...Object.entries(MCP_CONTROLLER_COVERAGE),
    ]
      .filter(([, d]) => ('excluded' in d ? !d.excluded.trim() : d.actions.length === 0))
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });
});
