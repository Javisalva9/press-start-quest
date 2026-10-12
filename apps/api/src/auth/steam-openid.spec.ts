import {
  SteamLoginError,
  buildSteamLoginUrl,
  verifySteamLogin,
} from './steam-openid.js';

const RETURN_TO = 'https://web.example.com/auth/steam/callback';
const STEAM_ID = '76561197960287930';
const NOW = new Date('2026-10-12T20:00:00Z');

/** A response like the one Steam adds to the callback URL. */
function steamResponse(overrides: Record<string, string> = {}): string {
  return new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'id_res',
    'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
    'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    'openid.identity': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    'openid.return_to': RETURN_TO,
    'openid.response_nonce': '2026-10-12T19:59:00ZaBcDeF123',
    'openid.assoc_handle': '1234567890',
    'openid.signed':
      'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.sig': 'c2lnbmF0dXJl',
    ...overrides,
  }).toString();
}

/** Makes Steam's check_authentication answer `isValid`. */
function steamSays(isValid: boolean) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(
        `ns:http://specs.openid.net/auth/2.0\nis_valid:${isValid}\n`,
      ),
    );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('buildSteamLoginUrl', () => {
  it('points to Steam with our return URL and realm', () => {
    const url = new URL(
      buildSteamLoginUrl(RETURN_TO, 'https://web.example.com'),
    );
    expect(url.origin + url.pathname).toBe(
      'https://steamcommunity.com/openid/login',
    );
    expect(url.searchParams.get('openid.mode')).toBe('checkid_setup');
    expect(url.searchParams.get('openid.return_to')).toBe(RETURN_TO);
    expect(url.searchParams.get('openid.realm')).toBe(
      'https://web.example.com',
    );
  });
});

describe('verifySteamLogin', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns the SteamID once Steam confirms the signature', async () => {
    const fetchMock = steamSays(true);
    await expect(verifySteamLogin(steamResponse(), RETURN_TO)).resolves.toBe(
      STEAM_ID,
    );
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('openid.mode')).toBe('check_authentication');
    expect(body.get('openid.sig')).toBe('c2lnbmF0dXJl');
  });

  it('fails when Steam rejects the signature', async () => {
    steamSays(false);
    await expect(verifySteamLogin(steamResponse(), RETURN_TO)).rejects.toThrow(
      SteamLoginError,
    );
  });

  it.each([
    ['a cancelled sign-in', { 'openid.mode': 'cancel' }],
    ['another provider', { 'openid.op_endpoint': 'https://evil.example.com' }],
    [
      'another return URL',
      { 'openid.return_to': 'https://evil.example.com/cb' },
    ],
    [
      'a malformed SteamID',
      { 'openid.claimed_id': 'https://steamcommunity.com/openid/id/123' },
    ],
    [
      'unsigned fields',
      { 'openid.signed': 'signed,op_endpoint,claimed_id,identity' },
    ],
    [
      'an old response',
      { 'openid.response_nonce': '2026-10-12T19:50:00ZaBcDeF123' },
    ],
  ])('rejects %s without calling Steam', async (_case, overrides) => {
    const fetchMock = steamSays(true);
    await expect(
      verifySteamLogin(steamResponse(overrides), RETURN_TO),
    ).rejects.toThrow(SteamLoginError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports Steam being down as a plain error, not an invalid sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 503 })),
    );
    const result = verifySteamLogin(steamResponse(), RETURN_TO);
    await expect(result).rejects.toThrow('Steam OpenID responded with 503');
    await expect(result).rejects.not.toBeInstanceOf(SteamLoginError);
  });
});
