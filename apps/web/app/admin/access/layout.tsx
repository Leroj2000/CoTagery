import type { ReactNode } from 'react';
import { requireActiveModule } from '../module-access';

export default async function AccessLayout({ children }: { children: ReactNode }) {
  await requireActiveModule('access');
  return children;
}
