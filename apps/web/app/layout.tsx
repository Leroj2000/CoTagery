import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Tagery — QR/NFC platforma',
  description: 'Multi-tenant platforma pro dynamické QR kódy a NFC tagy',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="cs" className={inter.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
