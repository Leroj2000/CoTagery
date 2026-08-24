import { evaluateBrowserSupport, isFirefox, isIos } from '../browser-support';

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const FIREFOX_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
const IPADOS_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

describe('detekce podporovaného a nepodporovaného prohlížeče', () => {
  it('podporuje prostředí s navigator.bluetooth', () => {
    expect(evaluateBrowserSupport({ hasBluetooth: true, userAgent: CHROME_ANDROID })).toEqual({
      supported: true,
    });
  });

  it('iOS bez Web Bluetooth → návod na Bluefy', () => {
    expect(evaluateBrowserSupport({ hasBluetooth: false, userAgent: SAFARI_IOS })).toEqual({
      supported: false,
      kind: 'ios-no-bluetooth',
    });
  });

  it('iPadOS hlásící se jako Mac (touch) je iOS', () => {
    expect(isIos(IPADOS_AS_MAC, 5)).toBe(true);
    expect(
      evaluateBrowserSupport({ hasBluetooth: false, userAgent: IPADOS_AS_MAC, maxTouchPoints: 5 }),
    ).toEqual({ supported: false, kind: 'ios-no-bluetooth' });
  });

  it('Firefox / jiný prohlížeč bez Bluetooth → obecně nepodporováno', () => {
    expect(isFirefox(FIREFOX_WIN)).toBe(true);
    expect(evaluateBrowserSupport({ hasBluetooth: false, userAgent: FIREFOX_WIN })).toEqual({
      supported: false,
      kind: 'unsupported',
    });
  });
});
