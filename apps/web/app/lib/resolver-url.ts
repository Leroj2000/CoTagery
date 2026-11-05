/** Veřejná resolver URL nosiče (`https://…/r/{publicCode}`). */
export function resolverPublicUrl(carrier: {
  resolverUrl?: string | null;
  publicCode: string;
}): string {
  if (carrier.resolverUrl) return carrier.resolverUrl;
  const base = (process.env.NEXT_PUBLIC_API_URL ?? 'https://app.tagery.tech').replace(/\/$/, '');
  return `${base}/r/${carrier.publicCode}`;
}
