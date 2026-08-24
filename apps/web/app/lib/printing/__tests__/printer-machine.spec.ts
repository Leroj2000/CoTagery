import { initialMachine, isBusy, reducer, type PrinterMachine } from '../printer-machine';
import { PrinterError, type PrinterInfo } from '../types';

const B1: PrinterInfo = {
  modelId: 4096,
  label: 'Niimbot B1',
  deviceName: 'B1-XYZ',
  task: 'b1',
  dpi: 203,
};

function run(events: Parameters<typeof reducer>[1][], start?: PrinterMachine): PrinterMachine {
  let m = start ?? initialMachine(true);
  for (const e of events) m = reducer(m, e);
  return m;
}

describe('stavový automat tiskárny', () => {
  it('start: podporováno → idle, nepodporováno → unsupported', () => {
    expect(initialMachine(true).state).toBe('idle');
    expect(initialMachine(false).state).toBe('unsupported');
  });

  it('přechod idle → connecting → connected', () => {
    const m1 = reducer(initialMachine(true), { type: 'connect-start' });
    expect(m1.state).toBe('connecting');
    const m2 = reducer(m1, { type: 'connect-success', printer: B1 });
    expect(m2.state).toBe('connected');
    expect(m2.printer).toEqual(B1);
  });

  it('odmítnutí výběru zařízení → error se srozumitelnou hláškou', () => {
    const m = run([
      { type: 'connect-start' },
      { type: 'fail', error: new PrinterError('cancelled', 'Výběr tiskárny byl zrušen.') },
    ]);
    expect(m.state).toBe('error');
    expect(m.error).toBe('Výběr tiskárny byl zrušen.');
    // Bez připojené tiskárny se reset vrací do idle.
    expect(reducer(m, { type: 'reset-error' }).state).toBe('idle');
  });

  it('reset po chybě s připojenou tiskárnou → connected', () => {
    const m = run([
      { type: 'connect-start' },
      { type: 'connect-success', printer: B1 },
      { type: 'fail', error: new PrinterError('print-failed', 'Tisk se nezdařil…') },
    ]);
    expect(m.state).toBe('error');
    expect(reducer(m, { type: 'reset-error' }).state).toBe('connected');
  });

  it('zákaz souběžného dvojitého tisku: druhý render-start během printing je no-op', () => {
    const connected = run([
      { type: 'connect-start' },
      { type: 'connect-success', printer: B1 },
    ]);
    const printing = run([{ type: 'render-start' }, { type: 'print-start' }], connected);
    expect(printing.state).toBe('printing');
    expect(isBusy(printing.state)).toBe(true);
    // Další pokus o tisk během běhu nesmí stav změnit.
    const again = reducer(printing, { type: 'render-start' });
    expect(again).toBe(printing);
  });

  it('connect-start během probíhající operace je ignorován', () => {
    const printing = run([
      { type: 'connect-start' },
      { type: 'connect-success', printer: B1 },
      { type: 'render-start' },
      { type: 'print-start' },
    ]);
    expect(reducer(printing, { type: 'connect-start' })).toBe(printing);
  });

  it('úspěšný tisk → success s českou hláškou', () => {
    const m = run([
      { type: 'connect-start' },
      { type: 'connect-success', printer: B1 },
      { type: 'render-start' },
      { type: 'print-start' },
      { type: 'print-success' },
    ]);
    expect(m.state).toBe('success');
    expect(m.progress).toBe('Štítek byl odeslán do tiskárny.');
  });
});
