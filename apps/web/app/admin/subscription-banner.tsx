import Link from 'next/link';
import { AlertTriangle, Clock } from 'lucide-react';
import type { SubscriptionStatus } from '@tagery/shared';
import { fmtDay } from '../lib/platform';

export interface SubscriptionStatusView {
  planName: string;
  status: SubscriptionStatus;
  periodEnd: string | null;
  daysLeft: number | null;
}

/** Upozornění na zkušební dobu, splatnost a pozastavení předplatného (nad obsahem adminu). */
export function SubscriptionBanner({
  status,
  canManage,
}: {
  status: SubscriptionStatusView | null;
  canManage: boolean;
}) {
  if (!status) return null;
  const link = canManage ? (
    <Link href="/admin/settings" className="font-medium underline">
      Předplatné
    </Link>
  ) : null;
  const days = status.daysLeft ?? 0;
  const daysText = `${days} ${days === 1 ? 'den' : days >= 2 && days <= 4 ? 'dny' : 'dní'}`;

  if (status.status === 'trialing') {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-900 ring-1 ring-inset ring-brand-200">
        <Clock size={16} className="mt-0.5 shrink-0" />
        <p>
          Zkušební doba{' '}
          {status.periodEnd ? `do ${fmtDay(status.periodEnd)} (zbývá ${daysText})` : ''}. Potom
          firma přejde na Free – data zůstanou. {link}
        </p>
      </div>
    );
  }
  if (status.status === 'past_due') {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>
          Předplatné {status.planName} je po splatnosti (skončilo {fmtDay(status.periodEnd)}). Bez
          úhrady se brzy pozastaví. {link}
        </p>
      </div>
    );
  }
  if (status.status === 'suspended' || status.status === 'canceled') {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-900 ring-1 ring-inset ring-red-200">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>
          Předplatné {status.planName} je{' '}
          {status.status === 'suspended' ? 'pozastavené' : 'zrušené'} – platí úroveň Free. Data
          zůstávají, některé funkce a zakládání nad limity jsou omezené. {link}
        </p>
      </div>
    );
  }
  return null;
}
