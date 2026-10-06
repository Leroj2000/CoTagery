import { Tags } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { Category } from '../../lib/types';
import { PageHeader, Section, Table, EmptyState } from '../ui';
import { ActionForm } from '../action-form';
import { ActionButton } from '../action-button';
import { createCategory, deleteCategory } from '../actions';
import { RenameCategory } from './rename';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const categories = await apiFetch<Category[]>('/categories');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kategorie"
        description="Číselník kategorií položek – používá se při zakládání položky."
        icon={<Tags size={18} />}
      />

      <Section title="Nová kategorie">
        <ActionForm
          action={createCategory}
          submitLabel="Přidat kategorii"
          fields={[
            { name: 'name', label: 'Název', required: true, placeholder: 'Elektrické nářadí' },
            {
              name: 'equipmentKind',
              label: 'Druh údržby',
              required: true,
              defaultValue: 'general',
              options: [
                { value: 'general', label: 'Běžná kategorie' },
                { value: 'vehicle', label: 'Vozidlo — kilometry' },
                { value: 'machine', label: 'Stroj — motohodiny' },
              ],
            },
          ]}
        />
      </Section>

      <Section title={`Kategorie (${categories.length})`}>
        {categories.length === 0 ? (
          <EmptyState>Zatím žádné kategorie.</EmptyState>
        ) : (
          <Table
            head={['Název', 'Druh údržby a úprava', 'Akce']}
            rows={categories.map((c) => [
              c.name,
              <RenameCategory key="r" id={c.id} current={c.name} equipmentKind={c.equipmentKind} />,
              <ActionButton
                key="d"
                action={deleteCategory}
                hidden={{ id: c.id }}
                label="Smazat"
                variant="danger"
                confirm={`Smazat kategorii „${c.name}"? Položkám se kategorie odpojí.`}
              />,
            ])}
          />
        )}
      </Section>
    </div>
  );
}
