import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { Policy, type TimeWindowConfig } from './entities/policy.entity';
import { PolicyAssignment } from './entities/policy-assignment.entity';

/** Vyhodnotí, zda je `now` uvnitř časového okna (čistá funkce, testovatelné). */
export function withinTimeWindow(cfg: TimeWindowConfig, now: Date): boolean {
  const tz = cfg.tz ?? 'UTC';
  // Den v týdnu (ISO 1=Po..7=Ne) a HH:MM v dané timezone.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const isoDay = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[wd] ?? 1;
  if (cfg.days && cfg.days.length > 0 && !cfg.days.includes(isoDay)) return false;
  const cur = `${hh}:${mm}`;
  if (cfg.from && cur < cfg.from) return false;
  if (cfg.to && cur > cfg.to) return false;
  return true;
}

/** Policy engine (EPIC-18 Fáze 4). MVP: time_window na membership. */
@Injectable()
export class PolicyService {
  constructor(private readonly context: TenantContextService) {}

  /** Vrátí důvod blokace, pokud aktivní time_window policy vylučuje `now`, jinak null. */
  async blockedReason(membershipId: string, now: Date = new Date()): Promise<string | null> {
    const rows: { config_json: TimeWindowConfig }[] = await this.context.manager.query(
      `SELECT p.config_json FROM policies p
         JOIN policy_assignments pa ON pa.policy_id = p.id
        WHERE p.type = 'time_window' AND p.status = 'active'
          AND pa.subject_type = 'membership' AND pa.subject_id = $1`,
      [membershipId],
    );
    for (const r of rows) {
      if (!withinTimeWindow(r.config_json, now)) {
        return 'Mimo povolené časové okno (policy)';
      }
    }
    return null;
  }

  private policies(): Repository<Policy> {
    return this.context.manager.getRepository(Policy);
  }
  private assignments(): Repository<PolicyAssignment> {
    return this.context.manager.getRepository(PolicyAssignment);
  }

  createTimeWindow(config: TimeWindowConfig): Promise<Policy> {
    const repo = this.policies();
    return repo.save(
      repo.create({ tenantId: this.context.tenantId, type: 'time_window', configJson: config, status: 'active' }),
    );
  }

  listPolicies(): Promise<Policy[]> {
    return this.policies().find({ order: { createdAt: 'DESC' } });
  }

  assign(policyId: string, subjectId: string): Promise<PolicyAssignment> {
    const repo = this.assignments();
    return repo.save(
      repo.create({ tenantId: this.context.tenantId, policyId, subjectType: 'membership', subjectId }),
    );
  }
}
