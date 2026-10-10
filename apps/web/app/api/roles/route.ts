import { proxyRoles } from './proxy';

/** BFF: přehled rolí firmy (GET) a založení vlastní role (POST). */
export function GET(): Promise<Response> {
  return proxyRoles('', 'GET');
}

export function POST(req: Request): Promise<Response> {
  return proxyRoles('', 'POST', req);
}
