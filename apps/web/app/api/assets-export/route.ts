import { downloadFrom } from '../../lib/download-proxy';

/** BFF: export položek – `?format=xlsx` (výchozí) nebo `?format=csv`. */
export async function GET(req: Request): Promise<Response> {
  const format = new URL(req.url).searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
  return downloadFrom(`/assets/export?format=${format}`);
}
