import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { TenantContextService } from '../../../core/tenancy/tenant-context.service';
import { AssetService } from '../../asset/asset.service';
import type { CreateAssetDto } from '../../asset/dto/asset.dto';
import type { Asset } from '../../asset/entities/asset.entity';
import { defineAction, type AnyChannelAction, type ActionExecutionContext } from './channel-action';

const uuid = z.string().uuid();

/** Bezpečný výřez položky pro kanály – jen pole potřebná v odpovědi. */
export interface AssetCard {
  id: string;
  name: string;
  status: string;
  category: string | null;
  inventoryNumber: string | null;
  registrationPlate: string | null;
  location: string | null;
  url: string;
}

/**
 * Akce v1 (spec §1). Všechny běží v kontextu aktivní firmy (RLS) a volají
 * stávající služby – žádná vlastní obchodní logika mimo ně.
 */
@Injectable()
export class V1ActionsProvider {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TenantContextService,
    private readonly assets: AssetService,
  ) {}

  private async locationNames(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const rows: { id: string; name: string }[] = await this.context.manager.query(
      `SELECT id, name FROM locations WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
      [this.context.tenantId, unique],
    );
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private async cards(ctx: ActionExecutionContext, list: Asset[]): Promise<AssetCard[]> {
    const names = await this.locationNames(list.map((a) => a.homeLocationId));
    return list.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      category: a.category ?? null,
      inventoryNumber: a.inventoryNumber ?? null,
      registrationPlate: a.registrationPlate ?? null,
      location: a.homeLocationId ? (names.get(a.homeLocationId) ?? null) : null,
      url: ctx.webUrl(`/admin/assets/${a.id}`),
    }));
  }

  actions(): AnyChannelAction[] {
    return [
      defineAction({
        key: 'org.list',
        title: 'Moje firmy',
        description: 'List organizations (companies) the user is an active member of.',
        input: z.object({}),
        permission: null,
        kind: 'read',
        requiresConfirmation: false,
        scope: 'user',
        execute: async (ctx) => {
          const rows: { organization_id: string; organization_name: string; role: string }[] =
            await this.dataSource.query(
              `SELECT organization_id, organization_name, role FROM my_memberships($1)`,
              [ctx.userId],
            );
          return rows.map((r) => ({
            id: r.organization_id,
            name: r.organization_name,
            role: r.role,
            active: r.organization_id === ctx.tenantId,
          }));
        },
      }),
      defineAction({
        key: 'asset.search',
        title: 'Hledat položky',
        description:
          'Search items (assets) of the active organization by name, inventory number, serial number or licence plate.',
        input: z.object({
          query: z.string().min(1).max(200).describe('Search text'),
          limit: z.number().int().min(1).max(20).optional(),
        }),
        permission: 'asset.item.view',
        kind: 'read',
        requiresConfirmation: false,
        scope: 'tenant',
        execute: async (ctx, input) => {
          const { items, total } = await this.assets.search(input.query);
          return { total, items: await this.cards(ctx, items.slice(0, input.limit ?? 10)) };
        },
      }),
      defineAction({
        key: 'asset.get',
        title: 'Detail položky',
        description:
          'Get item detail: where it is, who holds it, status, due date of return and open issues.',
        input: z.object({ assetId: uuid.describe('Item id from asset.search') }),
        permission: 'asset.item.view',
        kind: 'read',
        requiresConfirmation: false,
        scope: 'tenant',
        execute: async (ctx, input) => {
          const asset = await this.assets.get(input.assetId);
          const [card] = await this.cards(ctx, [asset]);
          const issues = (await this.assets.listIssues(asset.id)).filter(
            (i) => i.status === 'open',
          );
          return {
            ...card,
            manufacturer: asset.manufacturer ?? null,
            model: asset.model ?? null,
            serialNumber: asset.serialNumber ?? null,
            holderType: asset.currentHolderType,
            dueAt: asset.dueAt ? asset.dueAt.toISOString() : null,
            openIssues: issues.map((i) => ({ kind: i.kind, description: i.description })),
          };
        },
      }),
      defineAction({
        key: 'attention.list',
        title: 'Vyžaduje pozornost',
        description:
          'What needs attention: overdue loans, unconfirmed handovers, open issues and services due in 30 days.',
        input: z.object({}),
        permission: 'asset.item.view',
        kind: 'read',
        requiresConfirmation: false,
        scope: 'tenant',
        execute: async (ctx) => {
          const a = await this.assets.attention();
          const ids = [
            ...a.openIssues.map((i) => i.assetId),
            ...a.dueServices.map((s) => s.assetId),
          ];
          const names = new Map<string, string>();
          if (ids.length) {
            const rows: { id: string; name: string }[] = await this.context.manager.query(
              `SELECT id, name FROM assets WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
              [this.context.tenantId, [...new Set(ids)]],
            );
            for (const r of rows) names.set(r.id, r.name);
          }
          return {
            overdue: (await this.cards(ctx, a.overdue.slice(0, 10))).map((c, i) => ({
              ...c,
              dueAt: a.overdue[i].dueAt?.toISOString() ?? null,
            })),
            overdueCount: a.overdue.length,
            pendingConfirmationsCount: a.pendingConfirmations.length,
            openIssues: a.openIssues.slice(0, 10).map((i) => ({
              asset: names.get(i.assetId) ?? null,
              kind: i.kind,
              description: i.description,
            })),
            openIssuesCount: a.openIssues.length,
            dueServices: a.dueServices.slice(0, 10).map((s) => ({
              asset: names.get(s.assetId) ?? null,
              kind: s.kind,
              nextDueAt: s.nextDueAt ? s.nextDueAt.toISOString() : null,
            })),
            dueServicesCount: a.dueServices.length,
          };
        },
      }),
      defineAction({
        key: 'location.search',
        title: 'Hledat místa',
        description: 'Search locations (warehouses, rooms, vehicles…) of the active organization.',
        input: z.object({ query: z.string().min(1).max(100) }),
        permission: 'core.location.view',
        kind: 'read',
        requiresConfirmation: false,
        scope: 'tenant',
        execute: async (_ctx, input) => {
          const pattern = `%${input.query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
          const rows: { id: string; name: string; type: string }[] =
            await this.context.manager.query(
              `SELECT id, name, type FROM locations
                WHERE tenant_id = $1 AND name ILIKE $2 AND type <> 'access_point'
                ORDER BY name LIMIT 20`,
              [this.context.tenantId, pattern],
            );
          return rows;
        },
      }),
      defineAction({
        key: 'asset.create',
        title: 'Založit položku',
        description:
          'Create a new item (asset) in the active organization. Requires explicit user confirmation.',
        input: z.object({
          name: z.string().min(1).max(200),
          category: z.string().max(100).optional(),
          manufacturer: z.string().max(100).optional(),
          model: z.string().max(100).optional(),
          serialNumber: z.string().max(100).optional(),
          locationId: uuid.optional().describe('Home location id from location.search'),
        }),
        permission: 'asset.item.create',
        kind: 'write',
        requiresConfirmation: true,
        scope: 'tenant',
        summarize: (i) =>
          [
            `Založit položku „${i.name}"`,
            i.category ? `kategorie ${i.category}` : null,
            i.manufacturer || i.model ? [i.manufacturer, i.model].filter(Boolean).join(' ') : null,
            i.serialNumber ? `v. č. ${i.serialNumber}` : null,
          ]
            .filter(Boolean)
            .join(', '),
        execute: async (ctx, input) => {
          const dto: Partial<CreateAssetDto> = {
            name: input.name,
            category: input.category,
            manufacturer: input.manufacturer,
            model: input.model,
            serialNumber: input.serialNumber,
            homeLocationId: input.locationId,
          };
          const asset = await this.assets.create(dto as CreateAssetDto);
          return (await this.cards(ctx, [asset]))[0];
        },
      }),
      defineAction({
        key: 'asset.move',
        title: 'Přesunout položku',
        description: 'Move an item to another location. Requires explicit user confirmation.',
        input: z.object({ assetId: uuid, locationId: uuid }),
        permission: 'asset.movement.perform',
        kind: 'write',
        requiresConfirmation: true,
        scope: 'tenant',
        summarize: () => 'Přesunout položku na vybrané místo',
        execute: async (ctx, input) => {
          const asset = await this.assets.performMovement(input.assetId, {
            type: 'move',
            toType: 'location',
            toId: input.locationId,
          } as Parameters<AssetService['performMovement']>[1]);
          return (await this.cards(ctx, [asset]))[0];
        },
      }),
      defineAction({
        key: 'issue.report',
        title: 'Nahlásit závadu',
        description: 'Report an issue (damage, malfunction, missing part) on an item.',
        input: z.object({
          assetId: uuid,
          description: z.string().min(1).max(2000),
          kind: z.enum(['damage', 'malfunction', 'missing_part', 'other']).default('other'),
        }),
        permission: 'asset.issue.manage',
        kind: 'write',
        requiresConfirmation: true,
        scope: 'tenant',
        summarize: (i) => `Nahlásit závadu: ${i.description.slice(0, 100)}`,
        execute: async (ctx, input) => {
          const issue = await this.assets.reportIssue(input.assetId, {
            kind: input.kind,
            description: input.description,
          });
          return { id: issue.id, url: ctx.webUrl(`/admin/assets/${input.assetId}`) };
        },
      }),
    ];
  }
}
