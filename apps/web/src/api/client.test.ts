import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSession, saveSession } from '../auth/session';
import { ApiRequestError, apiUrl, authRequest } from './client';

describe('apiUrl', () => {
  it('uses relative paths when there is no base URL', () => {
    expect(apiUrl('/api/health')).toBe('/api/health');
  });

  it('avoids double slashes', () => {
    expect(apiUrl('/api/health', 'https://api.example.com/')).toBe(
      'https://api.example.com/api/health',
    );
  });

  it('adds the leading slash when missing', () => {
    expect(apiUrl('api/health', 'https://api.example.com')).toBe(
      'https://api.example.com/api/health',
    );
  });
});

/** Minimal localStorage for tests running in Node. */
class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

describe('authRequest', () => {
  const fetchMock = vi.fn<typeof fetch>();

  /** Saves a session whose access token expires in `expiresIn` seconds. */
  const signIn = (expiresIn = 900) =>
    saveSession({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresIn,
    });

  const refreshCalls = () =>
    fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/auth/refresh'),
    );

  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the access token', async () => {
    signIn();
    fetchMock.mockResolvedValue(json(200, { ok: true }));

    await expect(authRequest('/api/me')).resolves.toEqual({ ok: true });
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe('Bearer access-1');
  });

  it('refreshes first when the access token is about to expire', async () => {
    signIn(10);
    fetchMock
      .mockResolvedValueOnce(
        json(200, {
          accessToken: 'access-2',
          refreshToken: 'refresh-2',
          expiresIn: 900,
        }),
      )
      .mockResolvedValueOnce(json(200, { ok: true }));

    await authRequest('/api/me');

    expect(refreshCalls()).toHaveLength(1);
    expect(readSession()?.refreshToken).toBe('refresh-2');
    const headers = fetchMock.mock.calls[1][1]?.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe('Bearer access-2');
  });

  it('refreshes and retries once when the API answers 401', async () => {
    signIn();
    fetchMock
      .mockResolvedValueOnce(
        json(401, { statusCode: 401, code: 'UNAUTHENTICATED' }),
      )
      .mockResolvedValueOnce(
        json(200, {
          accessToken: 'access-2',
          refreshToken: 'refresh-2',
          expiresIn: 900,
        }),
      )
      .mockResolvedValueOnce(json(200, { ok: true }));

    await expect(authRequest('/api/me')).resolves.toEqual({ ok: true });
  });

  it('shares a single refresh between simultaneous requests', async () => {
    signIn(10);
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith('/auth/refresh')
        ? json(200, {
            accessToken: 'access-2',
            refreshToken: 'refresh-2',
            expiresIn: 900,
          })
        : json(200, { ok: true }),
    );

    await Promise.all([authRequest('/api/a'), authRequest('/api/b')]);

    expect(refreshCalls()).toHaveLength(1);
  });

  it('signs out when the refresh token is no longer valid', async () => {
    signIn(10);
    fetchMock.mockResolvedValue(
      json(401, { statusCode: 401, code: 'REFRESH_TOKEN_INVALID' }),
    );

    await expect(authRequest('/api/me')).rejects.toMatchObject({ status: 401 });
    expect(readSession()).toBeNull();
  });

  it('keeps the session when the network fails', async () => {
    signIn(10);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(authRequest('/api/me')).rejects.toThrow('Failed to fetch');
    expect(readSession()?.refreshToken).toBe('refresh-1');
  });

  it('turns API errors into ApiRequestError with their code', async () => {
    signIn();
    fetchMock.mockResolvedValue(
      json(503, { statusCode: 503, code: 'STEAM_UNAVAILABLE' }),
    );

    const error = await authRequest('/api/me').catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 503, code: 'STEAM_UNAVAILABLE' });
  });
});
