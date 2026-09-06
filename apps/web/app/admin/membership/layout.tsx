import type { ReactNode } from 'react';
import { requireActiveModule } from '../module-access';

export default async function MembershipLayout({ children }: { children: ReactNode }) {
  await requireActiveModule('membership');
  return children;
}
