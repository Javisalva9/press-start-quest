import { AuthTokensSchema, type Language } from '@psq/shared';
import { clearSession, readSession, saveSession } from '../auth/session';
import { apiUrl, request } from './client';

/** API route that sends the user to Steam to sign in. */
export function steamLoginUrl(): string {
  return apiUrl('/api/auth/steam', import.meta.env.VITE_API_URL ?? '');
}

/** Sends the API what Steam returned and saves the new session. */
export async function signInWithSteam(
  query: string,
  language: Language,
): Promise<void> {
  const body = await request('/api/auth/steam', {
    method: 'POST',
    body: JSON.stringify({ query, language }),
  });
  saveSession(AuthTokensSchema.parse(body));
}

/** Signs out locally right away and tells the API to close the session. */
export async function signOut(): Promise<void> {
  const session = readSession();
  clearSession();
  if (session) {
    // Best effort: if it fails, the session expires on its own anyway.
    await request('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).catch(() => undefined);
  }
}
