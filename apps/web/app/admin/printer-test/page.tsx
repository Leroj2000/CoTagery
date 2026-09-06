import { PrinterTestClient } from './printer-test-client';

/**
 * Diagnostická stránka tisku. Je pod `/admin`, takže ji chrání middleware a lze
 * ji použít také nad produkčním buildem při fyzické akceptaci tiskárny.
 */
export const dynamic = 'force-dynamic';

export default function PrinterTestPage() {
  return <PrinterTestClient />;
}
