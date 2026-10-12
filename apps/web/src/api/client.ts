import { ApiErrorSchema, AuthTokensSchema, type ErrorCode } from '@psq/shared';
import {
  clearSession,
  readSession,
  saveSession,
  type Session,
} from '../auth/session';

/** Joins the API base URL and a path, without double slashes. */
export function apiUrl(path: string, baseUrl = ''): string {
  const base = baseUrl.replace(/\/+$/, '');
  const route = path.startsWith('/') ? path : `/${path}`;
  return `${base}${route}`;
}

/** Empty locally (Vite forwards /api to the API); the API's URL on Render. */
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

/** An error response from the API, with its code when it sent one. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;

  constructor(status: number, code: ErrorCode | null) {
    super(`API responded with ${status}${code ? ` (${code})` : ''}`);
    this.status = status;
    this.code = code;
  }
}

/** Calls the API without a session. Returns the parsed JSON body, if any. */
export async function request(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(apiUrl(path, API_BASE_URL), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const body: unknown =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiErrorSchema.safeParse(body);
    throw new ApiRequestError(
      response.status,
      error.success ? error.data.code : null,
    );
  }
  return body;
}

/** Refreshes a bit early so a request doesn't leave with a token about to expire. */
const EXPIRY_MARGIN_MS = 30_000;

/**
 * Calls the API as the signed-in user. Renews the access token when needed
 * and retries once if the API still answers 401.
 */
export async function authRequest(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  let session = readSession();
  if (
    session &&
    session.accessTokenExpiresAt - EXPIRY_MARGIN_MS <= Date.now()
  ) {
    session = await refreshSession();
  }
  if (!session) {
    throw new ApiRequestError(401, 'UNAUTHENTICATED');
  }
  try {
    return await request(path, withToken(init, session));
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      throw error;
    }
    const renewed = await refreshSession();
    if (!renewed) {
      throw error;
    }
    return request(path, withToken(init, renewed));
  }
}

function withToken(init: RequestInit, session: Session): RequestInit {
  return {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${session.accessToken}`,
    },
  };
}

let refreshing: Promise<Session | null> | null = null;

/**
 * Gets new tokens with the refresh token. If several requests need it at the
 * same time, they share a single call: each refresh token works only once.
 * Resolves to null (and signs out) when the session is no longer valid.
 */
export function refreshSession(): Promise<Session | null> {
  refreshing ??= renewSession().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function renewSession(): Promise<Session | null> {
  const current = readSession();
  if (!current) {
    return null;
  }
  try {
    const body = await request('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    return saveSession(AuthTokensSchema.parse(body));
  } catch (error) {
    // Another tab may have just renewed the session and saved the new tokens.
    const latest = readSession();
    if (latest && latest.refreshToken !== current.refreshToken) {
      return latest;
    }
    if (error instanceof ApiRequestError && error.status === 401) {
      clearSession();
      return null;
    }
    // Network error or API asleep: keep the session and let the caller fail.
    throw error;
  }
}
