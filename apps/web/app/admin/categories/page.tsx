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
        description="Číselník kategorií věcí – používá se při zakládání věci."
        icon={<Tags size={18} />}
      />

      <Section title="Nová kategorie">
        <ActionForm
          action={createCategory}
          submitLabel="Přidat kategorii"
          fields={[{ name: 'name', label: 'Název', required: true, placeholder: 'Elektrické nářadí' }]}
        />
      </Section>

      <Section title={`Kategorie (${categories.length})`}>
        {categories.length === 0 ? (
          <EmptyState>Zatím žádné kategorie.</EmptyState>
        ) : (
          <Table
            head={['Název', 'Přejmenovat', 'Akce']}
            rows={categories.map((c) => [
              c.name,
              <RenameCategory key="r" id={c.id} current={c.name} />,
              <ActionButton
                key="d"
                action={deleteCategory}
                hidden={{ id: c.id }}
                label="Smazat"
                variant="danger"
                confirm={`Smazat kategorii „${c.name}"? Věcem se kategorie odpojí.`}
              />,
            ])}
          />
        )}
      </Section>
    </div>
  );
}
