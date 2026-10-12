import { downloadFrom } from '../../../../lib/download-proxy';

/** BFF: PDF faktury za předplatné vlastní firmy. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  return downloadFrom(`/subscription/invoices/${id}/pdf`);
}
