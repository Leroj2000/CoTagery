import { PRINTER_MESSAGES, toPrinterError } from '../printer-messages';
import { PrinterError } from '../types';

describe('mapování nízkoúrovňových chyb na české hlášky', () => {
  it('zrušený výběr zařízení (NotFoundError)', () => {
    const err = toPrinterError(Object.assign(new Error('User cancelled'), { name: 'NotFoundError' }));
    expect(err.kind).toBe('cancelled');
    expect(err.message).toBe(PRINTER_MESSAGES.cancelled);
  });

  it('mismatch modelu z knihovny (task/dpi) → wrong-model', () => {
    const err = toPrinterError(new Error('Selected label size is 300 dpi but Niimbot B1 prints at 203 dpi.'));
    expect(err.kind).toBe('wrong-model');
  });

  it('přerušené GATT spojení → disconnected', () => {
    const err = toPrinterError(new Error('GATT Server is disconnected.'));
    expect(err.kind).toBe('disconnected');
  });

  it('zachová již zabalený PrinterError', () => {
    const original = new PrinterError('render-failed', PRINTER_MESSAGES['render-failed']);
    expect(toPrinterError(original)).toBe(original);
  });

  it('neznámá chyba spadne na fallback', () => {
    expect(toPrinterError(new Error('cosi divného')).kind).toBe('print-failed');
    expect(toPrinterError(new Error('cosi'), 'connection-failed').kind).toBe('connection-failed');
  });
});
