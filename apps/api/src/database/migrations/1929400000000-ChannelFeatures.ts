import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-22: funkce předplatného `channel_telegram` a `channel_mcp` (součást
 * předplatného – Zkušební, Pro, Business). Existující firmy dostanou stav
 * `organization_modules.allowed` při dalším přepočtu předplatného (hodinový běh).
 */
export class ChannelFeatures1929400000000 implements MigrationInterface {
  name = 'ChannelFeatures1929400000000';

  async up(q: QueryRunner): Promise<void> {
    for (const feature of ['channel_telegram', 'channel_mcp']) {
      await q.query(
        `UPDATE platform_plans SET entitlements = array_append(entitlements, $1), updated_at = now()
          WHERE key IN ('trial', 'pro', 'business') AND NOT ($1 = ANY(entitlements))`,
        [feature],
      );
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const feature of ['channel_telegram', 'channel_mcp']) {
      await q.query(
        `UPDATE platform_plans SET entitlements = array_remove(entitlements, $1), updated_at = now()`,
        [feature],
      );
    }
  }
}
