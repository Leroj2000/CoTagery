import { proxyRoles } from '../proxy';

type Ctx = { params: Promise<{ key: string }> };

/** BFF: úprava (PUT) a smazání (DELETE) role. */
export async function PUT(req: Request, { params }: Ctx): Promise<Response> {
  const { key } = await params;
  return proxyRoles(`/${encodeURIComponent(key)}`, 'PUT', req);
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const { key } = await params;
  return proxyRoles(`/${encodeURIComponent(key)}`, 'DELETE');
}
