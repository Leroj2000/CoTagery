import { apiBase } from '../../../../lib/session';
import { getRenterToken } from '../../../../lib/renter-session';

/** BFF: stav sledování firmy pro přihlášeného nájemce (pro follow tlačítko). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<Response> {
  const { tenantId } = await params;
  const token = await getRenterToken();
  if (!token) return Response.json({ authenticated: false, following: false });
  const res = await fetch(`${apiBase()}/api/v1/network/follows`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return Response.json({ authenticated: true, following: false });
  const list = (await res.json()) as { tenantId: string }[];
  return Response.json({
    authenticated: true,
    following: list.some((f) => f.tenantId === tenantId),
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<Response> {
  const { tenantId } = await params;
  const token = await getRenterToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/network/follows/${tenantId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  return new Response(null, { status: res.status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<Response> {
  const { tenantId } = await params;
  const token = await getRenterToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/network/follows/${tenantId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  return new Response(null, { status: res.status });
}
