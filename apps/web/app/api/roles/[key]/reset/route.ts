import { proxyRoles } from '../../proxy';

/** BFF: vrácení systémové role na výchozí oprávnění. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
): Promise<Response> {
  const { key } = await params;
  return proxyRoles(`/${encodeURIComponent(key)}/reset`, 'POST');
}
