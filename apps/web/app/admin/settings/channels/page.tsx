import { redirect } from 'next/navigation';

/** Stará adresa – stránka se přesunula pod Integrace. */
export default function LegacyChannelsPage(): never {
  redirect('/admin/webhooks/channels');
}
