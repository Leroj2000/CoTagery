import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tagery',
  description: 'Multi-tenant QR/NFC platforma',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="cs">
      <body className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
