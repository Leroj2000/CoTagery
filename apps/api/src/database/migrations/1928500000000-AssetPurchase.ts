import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pořízení a záruky položky:
 * - `asset_purchases` (1:1 k položce) – datum, dodavatel, doklad, ceny bez/s DPH,
 *   sazba a snapshot „firma byla plátce DPH",
 * - `asset_warranties` (1:N) – víc záruk na položku (výrobce, baterie…),
 * - `asset_documents` – faktury a záruční listy (mimo časovou galerii, protože
 *   faktura nese cenu a čte ji jen oprávnění `asset.purchase.view`),
 * - servisní záznam druhu `warranty_claim` (reklamace),
 * - oprávnění `asset.purchase.view` / `asset.purchase.update`.
 * Plátce DPH a výchozí sazba jsou v `tenants.settings` (`vatPayer`, `defaultVatRate`).
 */
export class AssetPurchase1928500000000 implements MigrationInterface {
  name = 'AssetPurchase1928500000000';

  private readonly tables = ['asset_purchases', 'asset_documents', 'asset_warranties'];

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE asset_purchases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      purchased_on date,
      supplier text,
      document_number text,
      price_net numeric(14,2),
      vat_rate numeric(5,2),
      price_gross numeric(14,2),
      currency text NOT NULL DEFAULT 'CZK',
      vat_payer boolean NOT NULL DEFAULT false,
      note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, asset_id))`);

    await q.query(`CREATE TABLE asset_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      doc_type text NOT NULL CHECK (doc_type IN ('invoice', 'warranty', 'other')),
      file_name text,
      file_key text NOT NULL,
      mime text NOT NULL,
      size_bytes bigint,
      sha256 text,
      uploaded_by uuid,
      hidden boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX ix_asset_documents_asset ON asset_documents (asset_id)`);

    await q.query(`CREATE TABLE asset_warranties (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      title text NOT NULL,
      starts_on date,
      months integer CHECK (months IS NULL OR months > 0),
      ends_on date NOT NULL,
      provider text,
      note text,
      document_id uuid REFERENCES asset_documents(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX ix_asset_warranties_asset ON asset_warranties (asset_id)`);
    await q.query(`CREATE INDEX ix_asset_warranties_ends ON asset_warranties (tenant_id, ends_on)`);

    for (const t of this.tables) {
      await q.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
      await q.query(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`);
      await q.query(`CREATE POLICY tenant_isolation ON ${t}
        USING (tenant_id = current_setting('app.tenant_id',true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id',true)::uuid)`);
      await q.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${t} TO tagery_app`);
    }

    await q.query(`
      INSERT INTO permissions (key, module_key, resource, action, sensitivity) VALUES
        ('asset.purchase.view', 'asset', 'purchase', 'view', 'high'),
        ('asset.purchase.update', 'asset', 'purchase', 'update', 'high')
      ON CONFLICT (key) DO NOTHING`);
    // Systémové šablony (owner/admin mají all_permissions). Upravené kopie firem
    // je nedostanou automaticky (ADR 0013) – zapne je vlastník v matici rolí.
    await q.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p
        ON (r.key = 'manager' AND p.key IN ('asset.purchase.view', 'asset.purchase.update'))
        OR (r.key = 'editor' AND p.key = 'asset.purchase.view')
      WHERE r.tenant_id IS NULL
      ON CONFLICT DO NOTHING`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DELETE FROM permissions WHERE key IN ('asset.purchase.view', 'asset.purchase.update')`,
    );
    await q.query(`DROP TABLE asset_warranties`);
    await q.query(`DROP TABLE asset_documents`);
    await q.query(`DROP TABLE asset_purchases`);
  }
}
