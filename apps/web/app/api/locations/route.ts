import { apiFetch, ApiError } from '../../lib/server-api';

export async function POST(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(process.env.PUBLIC_WEB_URL ?? req.url).origin)
    return Response.json({ message: 'Neplatný původ požadavku.' }, { status: 403 });
  try {
    return Response.json(
      await apiFetch('/locations', { method: 'POST', body: JSON.stringify(await req.json()) }),
    );
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : 'Místo se nepodařilo uložit.' },
      { status: error instanceof ApiError ? error.status : 500 },
    );
  }
}
