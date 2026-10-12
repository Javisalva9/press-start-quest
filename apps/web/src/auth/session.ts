import type { AuthTokens } from '@psq/shared';

/**
 * The session lives in localStorage, shared by every tab of the app.
 *
 * Why not a cookie: on Render the web app and the API live on different
 * sites, and browsers (Safari above all) block cookies between sites.
 */
const STORAGE_KEY = 'psq.session';

/** Fired in this tab when the session changes (the "storage" event only reaches other tabs). */
const CHANGE_EVENT = 'psq:session-change';

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** When the access token expires (milliseconds since 1970, like Date.now()). */
  accessTokenExpiresAt: number;
}

export function readSession(): Session | null {
  return parseSession(localStorage.getItem(STORAGE_KEY));
}

export function saveSession(tokens: AuthTokens, now = Date.now()): Session {
  const session: Session = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: now + tokens.expiresIn * 1000,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return session;
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Calls `listener` when the session changes in this or any other tab. */
export function subscribeToSession(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

/** Raw stored value: a string, so React can compare snapshots cheaply. */
export function sessionSnapshot(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function parseSession(raw: string | null): Session | null {
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as Partial<Session>;
    if (
      typeof value.accessToken === 'string' &&
      typeof value.refreshToken === 'string' &&
      typeof value.accessTokenExpiresAt === 'number'
    ) {
      return value as Session;
    }
  } catch {
    // Corrupted value: treated as signed out.
  }
  return null;
}
