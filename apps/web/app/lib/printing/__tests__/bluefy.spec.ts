import {
  BLUEFY_APP_STORE_URL,
  bluefyOpenUrl,
  printHandoffPageUrl,
  shouldAutoOpenPrint,
} from '../bluefy';
import { evaluateBrowserSupport } from '../browser-support';

const CHROME_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1';
const ASSET = 'https://app.tagery.tech/admin/assets/d8727460-3772-461b-90bc-f3fa4f8fae87';
const CARRIER = '0b8b2f5e-1111-4222-8333-444455556666';

describe('předání tisku do Bluefy', () => {
  it('Chrome na iPhonu nemá Web Bluetooth → cesta přes Bluefy', () => {
    expect(evaluateBrowserSupport({ hasBluetooth: false, userAgent: CHROME_IOS })).toEqual({
      supported: false,
      kind: 'ios-no-bluetooth',
    });
  });

  it('odkaz bluefy://open?url= s absolutní adresou detailu a ?print=', () => {
    const page = printHandoffPageUrl(`${ASSET}#identifikator`, CARRIER);
    expect(page).toBe(`${ASSET}?print=${CARRIER}`);
    expect(bluefyOpenUrl(page)).toBe(`bluefy://open?url=${ASSET}?print=${CARRIER}`);
  });

  it('zachová jiné query a zakóduje jen znaky, které by rozbily parametr url', () => {
    const page = printHandoffPageUrl(`${ASSET}?tab=x&y=1`, CARRIER);
    expect(page).toBe(`${ASSET}?tab=x&y=1&print=${CARRIER}`);
    expect(bluefyOpenUrl(page)).toBe(`bluefy://open?url=${ASSET}?tab=x%26y=1%26print=${CARRIER}`);
  });

  it('po otevření v Bluefy se tisk otevře jen pro správný nosič', () => {
    expect(shouldAutoOpenPrint(`?print=${CARRIER}`, CARRIER)).toBe(true);
    expect(shouldAutoOpenPrint('?print=jiny', CARRIER)).toBe(false);
    expect(shouldAutoOpenPrint('', CARRIER)).toBe(false);
  });

  it('záložní odkaz do App Store zůstává', () => {
    expect(BLUEFY_APP_STORE_URL).toMatch(/^https:\/\/apps\.apple\.com\/.+id1492822055$/);
  });
});
