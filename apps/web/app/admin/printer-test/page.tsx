import { notFound } from 'next/navigation';
import { PrinterTestClient } from './printer-test-client';

/**
 * Vývojová testovací stránka tisku (sekce 12 zadání). Je pod `/admin`, takže ji
 * chrání middleware (jen přihlášení uživatelé). Navíc ji v produkčním buildu
 * úplně vypínáme přes NODE_ENV, aby ji neviděli běžní produkční uživatelé.
 */
export const dynamic = 'force-dynamic';

export default function PrinterTestPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <PrinterTestClient />;
}
