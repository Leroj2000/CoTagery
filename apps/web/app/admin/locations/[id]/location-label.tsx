'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function LocationLabel({ id, name }: { id: string; name: string }) {
  const [qr, setQr] = useState('');
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(`${window.location.origin}/admin/locations/${id}`, {
      width: 360,
      margin: 2,
    })
      .then((data) => {
        if (active) setQr(data);
      })
      .catch(() => {
        if (active) setQr('');
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer font-semibold">Štítek místa pro rychlé načtení</summary>
      <p className="mt-3 text-sm text-slate-600">
        Načtením otevřeš toto místo nebo ho vybereš při zařazování položky.
      </p>
      {qr ? (
        <>
          <img src={qr} alt={`QR místa ${name}`} className="h-48 w-48" />
          <a download={`misto-${id}.png`} href={qr} className="action-secondary">
            Stáhnout QR štítek
          </a>
        </>
      ) : (
        <p className="text-sm">QR se připravuje. Pokud se nezobrazí, obnov stránku.</p>
      )}
    </details>
  );
}
