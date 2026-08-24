import { ScanLine } from 'lucide-react';
import { PageHeader } from '../ui';
import { ScanClient } from './scan-client';

export const dynamic = 'force-dynamic';

export default function ScanPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader
        title="Sken"
        description="Naskenuj QR / čárový kód (náš i adoptovaný) → položka, stav a co s ní teď udělat."
        icon={<ScanLine size={18} />}
      />
      <ScanClient />
    </div>
  );
}
