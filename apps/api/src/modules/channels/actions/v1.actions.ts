import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { Asset as AssetEntity } from '../../asset/entities/asset.entity';
import { buildCustody, type CustodyInfo } from './custody';
import { z } from 'zod';
import { TenantContextService } from '../../../core/tenancy/tenant-context.service';
import { AssetService } from '../../asset/asset.service';
import { TiresService } from '../../asset/tires.service';
import { buildTireSets } from './tire-list';
import type { CreateAssetDto } from '../../asset/dto/asset.dto';
import type { Asset } from '../../asset/entities/asset.entity';
import { defineAction, type AnyChannelAction, type ActionExecutionContext } from './channel-action';

const uuid = z.string().uuid();

/** Bezpečný výřez položky pro kanály – jen pole potřebná v odpovědi. */
export interface AssetCard extends CustodyInfo {
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
    private readonly tires: TiresService,
  ) {}

  /**
   * Položka podle id (uuid), inventárního čísla, SPZ nebo kódu QR/štítku –
   * vše v kontextu aktivní firmy (RLS); sken se nezaznamenává.
   */
  private async resolveAsset(ref: string): Promise<Asset> {
    const value = ref.trim();
    if (uuid.safeParse(value).success) return this.assets.get(value);
    const rows: { id: string }[] = await this.context.manager.query(
      `SELECT id FROM assets
        WHERE tenant_id = $1
          AND (lower(inventory_number) = lower($2)
               OR upper(replace(registration_plate, ' ', '')) = upper(replace($2, ' ', '')))
        ORDER BY created_at LIMIT 1`,
      [this.context.tenantId, value],
    );
    if (rows[0]) return this.assets.get(rows[0].id);
    const scan = await this.assets.scanLookup(value, undefined, undefined, false);
    if (scan.asset?.id) return this.assets.get(scan.asset.id);
    throw new NotFoundException('Položka nenalezena');
  }

  private async locationNames(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const rows: { id: string; name: string }[] = await this.context.manager.query(
      `SELECT id, name FROM locations WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
      [this.context.tenantId, unique],
    );
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private async namesOf(table: 'people' | 'assets', ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map<string, string>();
    const rows: { id: string; name: string }[] = await this.context.manager.query(
      `SELECT id, name FROM ${table} WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
      [this.context.tenantId, unique],
    );
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /** Poslední pohyb každé položky (typ + čas) – „od kdy a jak ji kdo má“. */
  private async lastMoves(ids: string[]) {
    if (ids.length === 0) return new Map<string, { type: string; createdAt: Date }>();
    const rows: { asset_id: string; type: string; created_at: Date }[] =
      await this.context.manager.query(
        `SELECT DISTINCT ON (asset_id) asset_id, type, created_at FROM asset_movements
          WHERE tenant_id = $1 AND asset_id = ANY($2::uuid[])
          ORDER BY asset_id, created_at DESC`,
        [this.context.tenantId, ids],
      );
    return new Map(
      rows.map((r) => [r.asset_id, { type: r.type, createdAt: new Date(r.created_at) }]),
    );
  }

  private async cards(ctx: ActionExecutionContext, list: Asset[]): Promise<AssetCard[]> {
    const holderIds = (type: string) =>
      list.filter((a) => a.currentHolderType === type).map((a) => a.currentHolderId);
    const [location, person, assetNames, moves] = await Promise.all([
      this.locationNames([...list.map((a) => a.homeLocationId), ...holderIds('location')]),
      this.namesOf('people', holderIds('person')),
      this.namesOf('assets', holderIds('asset')),
      this.lastMoves(list.map((a) => a.id)),
    ]);
    return list.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      category: a.category ?? null,
      inventoryNumber: a.inventoryNumber ?? null,
      registrationPlate: a.registrationPlate ?? null,
      location: a.homeLocationId ? (location.get(a.homeLocationId) ?? null) : null,
      ...buildCustody(
        {
          currentHolderType: a.currentHolderType ?? null,
          currentHolderId: a.currentHolderId ?? null,
          homeLocationId: a.homeLocationId ?? null,
          dueAt: a.dueAt ?? null,
        },
        moves.get(a.id) ?? null,
        { person, location, asset: assetNames },
      ),
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
          'Search items (assets) of the active organization by name, inventory number, serial number or licence plate. Each item includes who holds it (holder), loan/assignment, since, due date, overdue and belongsTo.',
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
        key: 'asset.held_by',
        title: 'Co má osoba',
        description:
          'List items currently held by a person (e.g. "what does Jan Novák have"): loans and assignments with due dates and overdue flag. Read-only.',
        input: z.object({
          person: z.string().min(2).max(120).describe('Person name or part of it'),
          limit: z.number().int().min(1).max(50).optional(),
        }),
        permission: 'asset.item.view',
        kind: 'read',
        requiresConfirmation: false,
        scope: 'tenant',
        execute: async (ctx, input) => {
          const people: { id: string; name: string }[] = await this.context.manager.query(
            `SELECT id, name FROM people
              WHERE tenant_id = $1 AND name ILIKE '%' || $2 || '%'
              ORDER BY name LIMIT 10`,
            [this.context.tenantId, input.person.trim()],
          );
          if (people.length === 0) return { people: [], total: 0, items: [] };
          const held = await this.context.manager.getRepository(AssetEntity).find({
            where: { currentHolderType: 'person', currentHolderId: In(people.map((p) => p.id)) },
            order: { name: 'ASC' },
          });
          return {
            people: people.map((p) => p.name),
            total: held.length,
            items: await this.cards(ctx, held.slice(0, input.limit ?? 20)),
          };
        },
      }),
      defineAction({
        key: 'asset.get',
        title: 'Detail položky',
        description:
          'Get item detail: who holds it (person name), loan or assignment, since when, return-by date, overdue, home location (belongsTo), status and open issues.',
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
            openIssues: issues.map((i) => ({ kind: i.kind, description: i.description })),
          };
        },
      }),
      defineAction({
        key: 'tire.list',
        title: 'Pneumatiky položky',
        description:
          'List tire sets of a vehicle or machine: which set is mounted, size per axle (e.g. 205/55 R16 91V), season, tread depth, DOT, brand, quantity and where unmounted sets are stored. Read-only.',
        input: z.object({
          asset: z
            .string()
            .min(1)
            .max(120)
            .describe('Item id from asset.search, inventory number, registration plate or QR code'),
        }),
        permission: 'asset.item.view',
        kind: 'read',
        requiresConfirmation: false,
        scope: 'tenant',
        execute: async (ctx, input) => {
          const asset = await this.resolveAsset(input.asset);
          const [card] = await this.cards(ctx, [asset]);
          const rows = await this.tires.list(asset.id);
          const names = await this.locationNames(rows.map((r) => r.storedLocationId));
          const sets = buildTireSets(rows, names);
          return {
            asset: card,
            mounted: sets.find((s) => s.mounted)?.setLabel ?? null,
            sets,
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
