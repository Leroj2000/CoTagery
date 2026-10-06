'use client';
import { useState } from 'react';
import { useBarcodeScanner } from './use-scanner';

export function CodeInput({
  label,
  onRead,
  disabled = false,
}: {
  label: string;
  onRead: (code: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const scanner = useBarcodeScanner(onRead);
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-medium">{label}</p>
      <video
        ref={scanner.videoRef}
        muted
        playsInline
        className={scanner.camOn ? 'h-48 w-full rounded-lg bg-slate-900 object-cover' : 'hidden'}
      />
      <button
        type="button"
        disabled={disabled}
        className="action-secondary"
        onClick={scanner.camOn ? scanner.stop : scanner.start}
      >
        {scanner.camOn ? 'Vypnout kameru' : 'Načíst kamerou'}
      </button>
      <div className="flex gap-2">
        <input
          aria-label={label}
          className="field-input"
          value={value}
          disabled={disabled}
          placeholder="Kód / čtečka + Enter"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (value.trim()) onRead(value.trim());
            }
          }}
        />
        <button
          type="button"
          className="action-secondary"
          disabled={disabled || !value.trim()}
          onClick={() => onRead(value.trim())}
        >
          Použít
        </button>
      </div>
      {scanner.error && (
        <p role="alert" className="text-sm text-red-700">
          {scanner.error}
        </p>
      )}
    </div>
  );
}
