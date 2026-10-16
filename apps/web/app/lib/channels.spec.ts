import { formatRemaining, mcpEndpoint, parseExpiryDays } from './channels';

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
