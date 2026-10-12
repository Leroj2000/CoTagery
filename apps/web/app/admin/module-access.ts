import { redirect } from 'next/navigation';
import { apiFetch } from '../lib/server-api';

interface ModuleState {
  moduleKey: string;
  state: 'active' | 'inactive';
}

/**
 * Server-side ochrana stránky volitelného modulu. Skrytá navigace není
 * bezpečnostní hranice; přímá URL vypnutého modulu se vrátí na dashboard.
 */
export async function requireActiveModule(moduleKey: string): Promise<void> {
  const modules = await apiFetch<ModuleState[]>('/modules').catch(() => null);
  if (!modules) redirect('/admin');
  const module = modules.find((item) => item.moduleKey === moduleKey);
  if (!module || module.state !== 'active') redirect('/admin');
}

/** Klíče aktivních modulů a funkcí aktuální firmy (předplatné ⊕ volba vlastníka). */
export async function getActiveModules(): Promise<Set<string>> {
  const modules = await apiFetch<ModuleState[]>('/modules').catch(() => [] as ModuleState[]);
  return new Set(modules.filter((m) => m.state === 'active').map((m) => m.moduleKey));
}
