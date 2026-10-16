import { createHash } from 'node:crypto';
import { parseClientAuth } from './oauth.controller';
import {
  DEFAULT_REDIRECT_HOSTS,
  appendQuery,
  isAllowedRedirectUri,
  normalizeScope,
  resourceMatches,
  verifyPkce,
} from './oauth.util';

describe('oauth.util', () => {
  it('PKCE S256', () => {
    const verifier = 'a'.repeat(43) + '-._~';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce(verifier + 'x', challenge)).toBe(false);
    expect(verifyPkce('short', challenge)).toBe(false);
  });

  it('redirect URI allowlist', () => {
    const h = DEFAULT_REDIRECT_HOSTS;
    expect(isAllowedRedirectUri('https://chatgpt.com/connector_platform_oauth_redirect', h)).toBe(
      true,
    );
    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback', h)).toBe(true);
    expect(isAllowedRedirectUri('http://localhost:6274/callback', h)).toBe(true);
    expect(isAllowedRedirectUri('http://127.0.0.1:33418/cb', h)).toBe(true);
    expect(isAllowedRedirectUri('http://chatgpt.com/cb', h)).toBe(false);
    expect(isAllowedRedirectUri('https://evil.com/cb', h)).toBe(false);
    expect(isAllowedRedirectUri('https://chatgpt.com.evil.com/cb', h)).toBe(false);
    expect(isAllowedRedirectUri('https://chatgpt.com/cb#frag', h)).toBe(false);
    expect(isAllowedRedirectUri('javascript:alert(1)', h)).toBe(false);
    expect(isAllowedRedirectUri('not a url', h)).toBe(false);
  });

  it('scope a resource', () => {
    expect(normalizeScope(undefined)).toBe('mcp');
    expect(normalizeScope('mcp')).toBe('mcp');
    expect(normalizeScope('mcp admin')).toBeNull();
    expect(resourceMatches(undefined, 'https://x/mcp')).toBe(true);
    expect(resourceMatches('https://x/mcp/', 'https://x/mcp')).toBe(true);
    expect(resourceMatches('https://y/mcp', 'https://x/mcp')).toBe(false);
  });

  it('appendQuery zachová existující parametry', () => {
    expect(appendQuery('https://a.cz/cb?x=1', { code: 'c', state: undefined })).toBe(
      'https://a.cz/cb?x=1&code=c',
    );
  });

  it('parseClientAuth: Basic, post a none', () => {
    const basic = 'Basic ' + Buffer.from('tgc_1:tgs_2').toString('base64');
    expect(parseClientAuth(basic, {})).toEqual({
      clientId: 'tgc_1',
      clientSecret: 'tgs_2',
      method: 'client_secret_basic',
    });
    expect(parseClientAuth(undefined, { client_id: 'a', client_secret: 'b' }).method).toBe(
      'client_secret_post',
    );
    expect(parseClientAuth(undefined, { client_id: 'a' })).toEqual({
      clientId: 'a',
      method: 'none',
    });
  });
});
