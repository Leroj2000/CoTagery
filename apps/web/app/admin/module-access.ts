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
