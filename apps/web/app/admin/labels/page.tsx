import { Printer } from 'lucide-react';
import { apiFetch, getMyPermissions } from '../../lib/server-api';
import { EmptyState, PageHeader } from '../ui';
import type { LabelTemplatesView } from '../../lib/printing/label-templates';
import { LabelEditor } from './label-editor';

export const dynamic = 'force-dynamic';

export default async function LabelsPage() {
  const permissions = await getMyPermissions();
  if (!permissions.has('core.organization.configure')) {
    return <EmptyState>Editor štítků je dostupný jen správcům nastavení firmy.</EmptyState>;
  }
  const view = await apiFetch<LabelTemplatesView>('/label-templates');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Editor štítků"
        description="Vyber formát štítku a nastav, co se na něj tiskne. QR kód s logem firmy je vždy vlevo."
        icon={<Printer size={18} />}
      />
      <LabelEditor initial={view} />
    </div>
  );
}
