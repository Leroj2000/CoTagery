import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { Location } from '../entities/location.entity';
import type { CreateLocationDto } from './dto/create-location.dto';
import type { UpdateLocationDto } from './dto/update-location.dto';
import type { GenerateGridDto } from './dto/grid.dto';

/** Buňka mřížky se souřadnicí a obsazeností. */
export interface GridCell {
  id: string;
  row: number;
  col: number;
  label: string;
  assetCount: number;
}
export interface GridView {
  rows: number;
  cols: number;
  cells: GridCell[];
}
export interface CellAsset {
  id: string;
  name: string;
  status: string;
}

/** Label buňky: řada = písmeno (A, B, …), sloupec = číslo → „A1". */
function cellLabel(row: number, col: number): string {
  const letter = row <= 26 ? String.fromCharCode(64 + row) : `R${row}`;
  return `${letter}${col}`;
}

/**
 * Všechny dotazy jdou přes tenant-scoped manager (transakce se `app.tenant_id`),
 * takže RLS automaticky vrací jen data aktuálního tenantu (ADR-0001).
 */
@Injectable()
export class LocationsService {
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<Location> {
    return this.context.manager.getRepository(Location);
  }

  async list(): Promise<Location[]> {
    const scope = this.context.scope;
    if (scope.type !== 'ORGANIZATION' && (scope.type !== 'LOCATION_TREE' || !scope.ref)) return [];
    if (scope.type === 'LOCATION_TREE' && scope.ref) {
      const ids = await this.subtree(scope.ref);
      if (ids.length === 0) return [];
      return this.repo().find({ where: ids.map((id) => ({ id })), order: { createdAt: 'ASC' } });
    }
    return this.repo().find({ order: { createdAt: 'ASC' } });
  }

  private async subtree(rootId: string): Promise<string[]> {
    const rows: { id: string }[] = await this.context.manager.query(
      `WITH RECURSIVE sub AS (
         SELECT id FROM locations WHERE id = $1
         UNION
         SELECT l.id FROM locations l JOIN sub ON l.parent_id = sub.id
       ) SELECT id FROM sub`,
      [rootId],
    );
    return rows.map((r) => r.id);
  }

  async create(dto: CreateLocationDto): Promise<Location> {
    if (!dto.name.trim()) throw new BadRequestException('Vyplň název místa.');
    if (dto.parentId) {
      const parent = await this.get(dto.parentId);
      if (parent.type === 'cell')
        throw new BadRequestException('Pod buňku nelze zakládat další místa.');
    }
    if (this.context.scope.type !== 'ORGANIZATION' && !dto.parentId)
      throw new BadRequestException('Nové místo musí být ve svěřeném stromu.');
    const location = this.repo().create({
      ...dto,
      name: dto.name.trim(),
      tenantId: this.context.tenantId, // z JWT kontextu, nikdy z těla requestu
    });
    return this.repo().save(location);
  }

  async get(id: string): Promise<Location> {
    const location = await this.repo().findOne({ where: { id } });
    if (!location) throw new NotFoundException('Lokace neexistuje');
    const scope = this.context.scope;
    if (
      scope.type !== 'ORGANIZATION' &&
      (scope.type !== 'LOCATION_TREE' ||
        !scope.ref ||
        !(await this.subtree(scope.ref)).includes(id))
    ) {
      throw new NotFoundException('Lokace neexistuje');
    }
    return location;
  }

  async update(id: string, dto: UpdateLocationDto): Promise<Location> {
    // Serialize reparenting: two simultaneous moves must not introduce a cycle.
    await this.context.manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `locations:${this.context.tenantId}`,
    ]);
    const location = await this.get(id);
    if (dto.parentId === id) throw new BadRequestException('Lokace nemůže být rodičem sama sobě');
    if (dto.parentId) {
      const parent = await this.get(dto.parentId);
      if (parent.type === 'cell')
        throw new BadRequestException('Pod buňku nelze místo přeřadit.');
      if ((await this.subtree(id)).includes(dto.parentId))
        throw new BadRequestException('Místo nelze vložit do vlastního podřízeného místa.');
    }
    if (dto.parentId === null && this.context.scope.type !== 'ORGANIZATION')
      throw new BadRequestException('Místo musí zůstat ve svěřeném stromu.');
    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestException('Vyplň název místa.');
      location.name = dto.name.trim();
    }
    if (dto.type !== undefined) location.type = dto.type;
    if (dto.address !== undefined) location.address = dto.address || null;
    if (dto.timezone) location.timezone = dto.timezone;
    if (dto.parentId !== undefined) location.parentId = dto.parentId || null;
    return this.repo().save(location);
  }

  // --- Mřížka (regál/skříň) ---

  /** Počty položek (home_location_id) pro sadu buněk. */
  private async assetCounts(cellIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (cellIds.length === 0) return map;
    const rows = (await this.repo().manager.query(
      `SELECT home_location_id AS id, count(*)::int AS n FROM assets
       WHERE home_location_id = ANY($1) GROUP BY home_location_id`,
      [cellIds],
    )) as { id: string; n: number }[];
    for (const r of rows) map.set(r.id, Number(r.n));
    return map;
  }

  /**
   * Idempotentně vygeneruje/přegeneruje mřížku buněk (child lokace) pro
   * regál/skříň. Zmenšení odmítne, pokud by osiřely buňky s položkami.
   */
  async generateGrid(id: string, dto: GenerateGridDto): Promise<GridView> {
    const parent = await this.get(id);
    const repo = this.repo();
    const cells = await repo.find({
      where: { parentId: id },
      order: { cellRow: 'ASC', cellCol: 'ASC' },
    });
    const gridCells = cells.filter((c) => c.cellRow != null && c.cellCol != null);
    const outOfBounds = gridCells.filter(
      (c) => (c.cellRow ?? 0) > dto.rows || (c.cellCol ?? 0) > dto.cols,
    );

    // Blokace: zmenšovaná buňka s položkami se nesmaže.
    const counts = await this.assetCounts(outOfBounds.map((c) => c.id));
    const blocked = outOfBounds.filter((c) => (counts.get(c.id) ?? 0) > 0);
    if (blocked.length > 0) {
      const labels = blocked.map((c) => cellLabel(c.cellRow!, c.cellCol!)).join(', ');
      throw new ConflictException(
        `Nelze zmenšit – tyto buňky obsahují položky: ${labels}. Nejdřív je vyprázdni.`,
      );
    }

    // Smaž prázdné buňky mimo rozsah, dogeneruj chybějící, ulož rozměry.
    if (outOfBounds.length > 0) await repo.remove(outOfBounds);
    const present = new Set(
      gridCells.filter((c) => !outOfBounds.includes(c)).map((c) => `${c.cellRow}:${c.cellCol}`),
    );
    const toCreate: Location[] = [];
    for (let r = 1; r <= dto.rows; r++) {
      for (let c = 1; c <= dto.cols; c++) {
        if (present.has(`${r}:${c}`)) continue;
        toCreate.push(
          repo.create({
            tenantId: this.context.tenantId,
            parentId: id,
            type: 'cell',
            name: cellLabel(r, c),
            cellRow: r,
            cellCol: c,
          }),
        );
      }
    }
    if (toCreate.length > 0) await repo.save(toCreate);
    parent.gridRows = dto.rows;
    parent.gridCols = dto.cols;
    await repo.save(parent);
    return this.getGrid(id);
  }

  async getGrid(id: string): Promise<GridView> {
    const parent = await this.get(id);
    const cells = (await this.repo().find({ where: { parentId: id } })).filter(
      (c) => c.cellRow != null && c.cellCol != null,
    );
    const counts = await this.assetCounts(cells.map((c) => c.id));
    return {
      rows: parent.gridRows ?? 0,
      cols: parent.gridCols ?? 0,
      cells: cells
        .map((c) => ({
          id: c.id,
          row: c.cellRow!,
          col: c.cellCol!,
          label: cellLabel(c.cellRow!, c.cellCol!),
          assetCount: counts.get(c.id) ?? 0,
        }))
        .sort((a, b) => a.row - b.row || a.col - b.col),
    };
  }

  /** Položky umístěné v dané buňce (home_location_id = buňka). */
  async cellAssets(id: string): Promise<CellAsset[]> {
    await this.get(id); // ověří existenci + tenant scope
    return (await this.repo().manager.query(
      `SELECT id, name, status FROM assets WHERE home_location_id = $1 ORDER BY name`,
      [id],
    )) as CellAsset[];
  }
}
