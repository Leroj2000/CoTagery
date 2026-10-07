'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { detectBrowserSupport } from './browser-support';
import { clampCopies } from './copies';
import { connectPrinter, printLabel } from './niimbot-client';
import { toPrinterError } from './printer-messages';
import { initialMachine, isBusy, reducer, type PrinterMachine } from './printer-machine';
import type { LabelData } from './types';
import type { RenderOptions } from './render-label';

/**
 * React hook nad izolovanou tiskovou vrstvou. Řídí stavový automat, průběh
 * tisku, identifikaci tiskárny a uživatelsky čitelnou (českou) chybu.
 *
 * Používej pouze v „use client“ komponentě. Detekce podpory běží až v efektu
 * (klient), takže SSR nesahá na `navigator`.
 */
export type UseNiimbotPrinter = PrinterMachine & {
  /** Je Web Bluetooth v tomto prostředí k dispozici? */
  supported: boolean;
  /** Kategorie nepodpory (pro návod na Bluefy) – jen když `supported === false`. */
  unsupportedKind: 'ios-no-bluetooth' | 'unsupported' | null;
  connect: () => Promise<void>;
  printLabel: (data: LabelData, copies?: number, options?: RenderOptions) => Promise<void>;
  resetError: () => void;
};

export function useNiimbotPrinter(): UseNiimbotPrinter {
  // Start pesimisticky jako „unsupported“ – přepíšeme v efektu na klientovi,
  // aby první render na serveru i klientovi seděl (žádný přístup k navigatoru).
  const [machine, dispatch] = useReducer(reducer, false, initialMachine);
  const supportRef = useRef<{
    supported: boolean;
    kind: 'ios-no-bluetooth' | 'unsupported' | null;
  }>({
    supported: false,
    kind: 'unsupported',
  });
  // Zamek proti dvojitému odeslání (drží i mezi rendery během jedné operace).
  const busyRef = useRef(false);

  useEffect(() => {
    const support = detectBrowserSupport();
    supportRef.current = {
      supported: support.supported,
      kind: support.supported ? null : support.kind,
    };
    dispatch({ type: 'init', supported: support.supported });
  }, []);

  const connect = useCallback(async () => {
    if (busyRef.current || isBusy(machine.state)) return;
    busyRef.current = true;
    dispatch({ type: 'connect-start' });
    try {
      const printer = await connectPrinter();
      dispatch({ type: 'connect-success', printer });
    } catch (err) {
      dispatch({ type: 'fail', error: toPrinterError(err, 'connection-failed') });
    } finally {
      busyRef.current = false;
    }
  }, [machine.state]);

  const doPrint = useCallback(
    async (data: LabelData, copies = 1, options: RenderOptions = {}) => {
      // Zákaz souběžného dvojitého tisku (sekce 5/13 zadání).
      if (busyRef.current || isBusy(machine.state)) return;
      busyRef.current = true;
      const count = clampCopies(copies);
      dispatch({ type: 'render-start' });
      try {
        dispatch({ type: 'print-start' });
        await printLabel(
          data,
          count,
          (message) => dispatch({ type: 'progress', message }),
          options,
        );
        dispatch({ type: 'print-success' });
      } catch (err) {
        dispatch({ type: 'fail', error: toPrinterError(err, 'print-failed') });
      } finally {
        busyRef.current = false;
      }
    },
    [machine.state],
  );

  const resetError = useCallback(() => {
    dispatch({ type: 'reset-error' });
  }, []);

  return {
    ...machine,
    supported: supportRef.current.supported,
    unsupportedKind: supportRef.current.kind,
    connect,
    printLabel: doPrint,
    resetError,
  };
}
