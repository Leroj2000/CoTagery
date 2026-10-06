import { apiFetch, ApiError } from '../../lib/server-api';
export async function GET(req: Request): Promise<Response> {
  const query = new URL(req.url).searchParams.get('q') ?? '';
  try {
    return Response.json(
      await apiFetch(`/assets/search?q=${encodeURIComponent(query.slice(0, 200))}`),
    );
  } catch (e) {
    return Response.json(
      { message: 'Vyhledávání se nepodařilo dokončit.' },
      { status: e instanceof ApiError ? e.status : 500 },
    );
  }
}
