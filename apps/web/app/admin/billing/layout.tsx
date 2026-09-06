import type { ReactNode } from 'react';
import { requireActiveModule } from '../module-access';

export default async function BillingLayout({ children }: { children: ReactNode }) {
  await requireActiveModule('billing');
  return children;
}
