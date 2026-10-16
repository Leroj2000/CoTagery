import {
  formatRemaining,
  mcpEndpoint,
  parseExpiryDays,
  pickOAuthParams,
  redirectHost,
} from './channels';

describe('channels helpers', () => {
  it('mcpEndpoint odřízne /api/v1 a koncová lomítka', () => {
    expect(mcpEndpoint('https://app.tagery.tech')).toBe('https://app.tagery.tech/mcp');
    expect(mcpEndpoint('https://app.tagery.tech/')).toBe('https://app.tagery.tech/mcp');
    expect(mcpEndpoint('https://x.cz/api/v1/')).toBe('https://x.cz/mcp');
  });

  it('formatRemaining', () => {
    expect(formatRemaining(600)).toBe('10:00');
    expect(formatRemaining(65.9)).toBe('1:05');
    expect(formatRemaining(-3)).toBe('0:00');
  });

  it('parseExpiryDays', () => {
    expect(parseExpiryDays('30')).toBe(30);
    expect(parseExpiryDays('never')).toBeNull();
    expect(parseExpiryDays('hack')).toBe(90);
    expect(parseExpiryDays(null)).toBe(90);
  });
});

describe('OAuth helpers', () => {
  it('pickOAuthParams vybere jen známé parametry', () => {
    expect(pickOAuthParams({ client_id: 'c', state: ['s1', 's2'], evil: 'x', scope: '' })).toEqual({
      client_id: 'c',
      state: 's1',
    });
  });

  it('redirectHost', () => {
    expect(redirectHost('https://chatgpt.com/connector_platform_oauth_redirect')).toBe(
      'chatgpt.com',
    );
    expect(redirectHost('nonsense')).toBe('nonsense');
  });
});
