import { captureScanPosition } from './scan-position';

describe('one-shot scan position', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });
  function navigatorWith(geolocation?: unknown) {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation } });
  }
  it('keeps scanning usable without geolocation', async () => {
    navigatorWith();
    await expect(captureScanPosition()).resolves.toBeUndefined();
  });
  it.each([1, 2, 3])('keeps scanning usable after geolocation error %s', async (code) => {
    navigatorWith({
      getCurrentPosition: (_ok: unknown, fail: (error: unknown) => void) => fail({ code }),
    });
    const unavailable = jest.fn();
    await expect(captureScanPosition(unavailable)).resolves.toBeUndefined();
    expect(unavailable).toHaveBeenCalledTimes(1);
  });
  it('captures coordinates, accuracy and device timestamp once', async () => {
    const getCurrentPosition = jest.fn((ok) =>
      ok({ coords: { latitude: 50, longitude: 14, accuracy: 12 }, timestamp: 1000 }),
    );
    navigatorWith({ getCurrentPosition });
    await expect(captureScanPosition()).resolves.toEqual({
      latitude: 50,
      longitude: 14,
      accuracyMeters: 12,
      capturedAt: '1970-01-01T00:00:01.000Z',
      source: 'device',
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0]).toHaveLength(3);
  });
});
