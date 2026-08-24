import { PRINT_SUCCESS_MESSAGE, PRINTER_MESSAGES } from './printer-messages';
import type { PrinterError, PrinterInfo, PrinterState } from './types';

/**
 * Čistý stavový automat tiskárny (bez Reactu a bez Bluetooth) – snadno
 * testovatelný. Hook `useNiimbotPrinter` ho jen řídí a mapuje na React state.
 */

export type PrinterMachine = {
  state: PrinterState;
  printer: PrinterInfo | null;
  progress: string | null;
  error: string | null;
};

export type PrinterEvent =
  | { type: 'init'; supported: boolean }
  | { type: 'connect-start' }
  | { type: 'connect-success'; printer: PrinterInfo }
  | { type: 'render-start' }
  | { type: 'print-start' }
  | { type: 'progress'; message: string }
  | { type: 'print-success' }
  | { type: 'fail'; error: PrinterError }
  | { type: 'reset-error' };

export function initialMachine(supported: boolean): PrinterMachine {
  return {
    state: supported ? 'idle' : 'unsupported',
    printer: null,
    progress: null,
    error: supported ? null : PRINTER_MESSAGES.unsupported,
  };
}

/** Je právě probíhá operace, při které nesmíme spustit další tisk/připojení? */
export function isBusy(state: PrinterState): boolean {
  return state === 'connecting' || state === 'rendering' || state === 'printing';
}

export function reducer(machine: PrinterMachine, event: PrinterEvent): PrinterMachine {
  switch (event.type) {
    case 'init':
      return initialMachine(event.supported);

    case 'connect-start':
      if (isBusy(machine.state)) return machine; // zákaz souběhu
      return { ...machine, state: 'connecting', error: null, progress: null };

    case 'connect-success':
      return { ...machine, state: 'connected', printer: event.printer, error: null };

    case 'render-start':
      // Tisknout smíme jen z klidového „connected“/„idle“/„success“ – ne během běhu.
      if (isBusy(machine.state)) return machine;
      return { ...machine, state: 'rendering', error: null, progress: null };

    case 'print-start':
      return { ...machine, state: 'printing' };

    case 'progress':
      return { ...machine, progress: event.message };

    case 'print-success':
      return { ...machine, state: 'success', progress: PRINT_SUCCESS_MESSAGE };

    case 'fail':
      return { ...machine, state: 'error', error: event.error.message, progress: null };

    case 'reset-error':
      if (machine.state !== 'error') return machine;
      // Po chybě se vrať do „connected“, pokud tiskárnu známe, jinak do „idle“.
      return {
        ...machine,
        state: machine.printer ? 'connected' : 'idle',
        error: null,
        progress: null,
      };

    default:
      return machine;
  }
}
