import { apiFetch, ApiError } from '../../../lib/server-api';
export async function GET(): Promise<Response> {
  try {
    return Response.json(await apiFetch('/personal-workflows/me'));
  } catch (e) {
    return Response.json(
      { message: e instanceof Error ? e.message : 'Osobní přehled není dostupný.' },
      { status: e instanceof ApiError ? e.status : 500 },
    );
  }
}
