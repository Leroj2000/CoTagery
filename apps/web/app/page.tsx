import { redirect } from 'next/navigation';

/**
 * Kořenová stránka jen přesměruje do administrace. Middleware pak neautentizované
 * pošle na /login. (Dřív tu byl vývojový „health skeleton".)
 */
export default function Home() {
  redirect('/admin');
}
