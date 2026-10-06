import { apiFetch, ApiError } from '../../../../../lib/server-api';
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  try {
    return Response.json(
      await apiFetch(`/personal-workflows/handoffs/${id}/confirm`, {
        method: 'POST',
        body: JSON.stringify(await req.json()),
      }),
    );
  } catch (e) {
    return Response.json(
      { message: e instanceof Error ? e.message : 'Potvrzení selhalo.' },
      { status: e instanceof ApiError ? e.status : 500 },
    );
  }
}
