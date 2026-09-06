import type { ReactNode } from 'react';
import { requireActiveModule } from '../module-access';

export default async function RentalLayout({ children }: { children: ReactNode }) {
  await requireActiveModule('rental');
  return children;
}
