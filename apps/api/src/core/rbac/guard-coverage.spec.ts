import 'reflect-metadata';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import {
  ALLOW_AUTHENTICATED_ONLY_KEY,
  REQUIRE_PERMISSION_KEY,
} from './require-permission.decorator';

/**
 * SEC-07: jednotné vynucení oprávnění. Guardy se v API nastavují per controller
 * (žádný globální APP_GUARD), takže zapomenutý `PermissionsGuard` by endpoint
 * otevřel každému přihlášenému členovi. Test bez bootu aplikace projde všechny
 * `*.controller.ts` a vyžaduje:
 *  1. každý route s `PermissionsGuard` má `@RequirePermission` nebo
 *     `@AllowAuthenticatedOnly()` (na metodě nebo třídě),
 *  2. controller bez `PermissionsGuard` je výslovně na seznamu níže s důvodem
 *     (veřejné, nájemce marketplace, platformní admin, webhook, přihlášení).
 */
const NON_MEMBER_CONTROLLERS: Record<string, string> = {
  HealthController: 'veřejný health check',
  AuthController: 'přihlášení / refresh / odhlášení – jen JWT identity, bez firmy',
  ActivationController: 'veřejná aktivace nosiče přes token',
  ResolverController: 'veřejné rozlišení QR/NFC kódu',
  PlatformController: 'platformní admin – PlatformAdminGuard (is_platform_admin)',
  SpecCallbackController: 'callback AI zpracování – podepsaný token',
  ManualCallbackController: 'callback AI zpracování manuálu – podepsaný token',
  BillingWebhookController: 'webhook platební brány – ověření podpisu',
  NetworkPublicController: 'veřejný katalog sítě půjčoven',
  NetworkController: 'nájemce marketplace – RenterJwtGuard',
  McpController: 'MCP – vlastní token kanálu, oprávnění řeší ActionExecutor',
  TelegramWebhookController: 'webhook Telegramu – secret token, oprávnění řeší ActionExecutor',
  PublicCalendarController: 'sdílený kalendář přes neuhodnutelný token (view/ics)',
  OAuthPublicController: 'OAuth 2.1 metadata/registrace/token pro MCP klienty',
  FoundPublicController: 'veřejné nahlášení nálezu ze štítku',
  RenterAuthController: 'přihlášení nájemce marketplace',
  RenterOrderController: 'nájemce marketplace – RenterJwtGuard',
  PublicRentalController: 'veřejný katalog půjčovny',
};

const SRC = join(__dirname, '../..');
const CONTROLLER_WATERMARK = '__controller__';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function guardNames(target: object): string[] {
  const guards = (Reflect.getMetadata(GUARDS_METADATA, target) ?? []) as unknown[];
  return guards.map((g) =>
    typeof g === 'function' ? g.name : String((g as object)?.constructor?.name),
  );
}

interface Finding {
  controller: string;
  file: string;
  problem: string;
}

function audit(): { controllers: string[]; findings: Finding[] } {
  const controllers: string[] = [];
  const findings: Finding[] = [];
  for (const file of walk(SRC).filter((f) => f.endsWith('.controller.ts'))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file) as Record<string, unknown>;
    for (const value of Object.values(mod)) {
      if (typeof value !== 'function' || !Reflect.getMetadata(CONTROLLER_WATERMARK, value))
        continue;
      const cls = value as new (...args: never[]) => unknown;
      controllers.push(cls.name);
      const rel = relative(SRC, file);
      const classGuards = guardNames(cls);
      const classPerm = Reflect.getMetadata(REQUIRE_PERMISSION_KEY, cls) as string | undefined;
      const classAllow = Reflect.getMetadata(ALLOW_AUTHENTICATED_ONLY_KEY, cls) as
        boolean | undefined;
      const allowlisted = cls.name in NON_MEMBER_CONTROLLERS;
      let anyPermGuard = classGuards.includes('PermissionsGuard');
      for (const key of Object.getOwnPropertyNames(cls.prototype)) {
        if (key === 'constructor') continue;
        const handler = (cls.prototype as Record<string, unknown>)[key];
        if (typeof handler !== 'function') continue;
        if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
        if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
        const guards = [...classGuards, ...guardNames(handler)];
        const perm = Reflect.getMetadata(REQUIRE_PERMISSION_KEY, handler) ?? classPerm;
        const allow = Reflect.getMetadata(ALLOW_AUTHENTICATED_ONLY_KEY, handler) ?? classAllow;
        if (guards.includes('PermissionsGuard')) {
          anyPermGuard = true;
          if (!perm && !allow)
            findings.push({
              controller: cls.name,
              file: rel,
              problem: `${key}: PermissionsGuard bez @RequirePermission/@AllowAuthenticatedOnly`,
            });
        } else if (!allowlisted) {
          findings.push({
            controller: cls.name,
            file: rel,
            problem: `${key}: route bez PermissionsGuard`,
          });
        }
        if ((perm || allow) && !guards.includes('PermissionsGuard'))
          findings.push({
            controller: cls.name,
            file: rel,
            problem: `${key}: @RequirePermission bez PermissionsGuard (nevynucuje se)`,
          });
      }
      if (allowlisted && anyPermGuard)
        findings.push({
          controller: cls.name,
          file: rel,
          problem:
            'je v NON_MEMBER_CONTROLLERS, ale používá PermissionsGuard – odeber ho ze seznamu',
        });
    }
  }
  return { controllers, findings };
}

describe('SEC-07 jednotné vynucení oprávnění', () => {
  const { controllers, findings } = audit();

  it('najde controllery', () => {
    expect(controllers.length).toBeGreaterThan(50);
  });

  it('každý členský endpoint má PermissionsGuard a explicitní oprávnění', () => {
    expect(findings.map((f) => `${f.file} ${f.controller}.${f.problem}`)).toEqual([]);
  });

  it('seznam výjimek neobsahuje neexistující controllery', () => {
    const names = new Set(controllers);
    expect(Object.keys(NON_MEMBER_CONTROLLERS).filter((n) => !names.has(n))).toEqual([]);
  });
});
