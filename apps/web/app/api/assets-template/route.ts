import { downloadFrom } from '../../lib/download-proxy';

/** BFF: šablona pro import položek (`?format=xlsx|csv`). */
export async function GET(req: Request): Promise<Response> {
  const format = new URL(req.url).searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
  return downloadFrom(`/assets/import-template?format=${format}`);
}
