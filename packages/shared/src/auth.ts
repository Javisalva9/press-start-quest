import { z } from 'zod';
import { LanguageSchema } from './language.js';

/** Body of POST /api/auth/steam: what Steam sent back to the web app. */
export const SteamLoginRequestSchema = z.object({
  /** Query string Steam added to the callback URL (`location.search`). */
  query: z.string().min(1).max(4096),
  /** Device language: only used when the account is created. */
  language: LanguageSchema.optional(),
});

export type SteamLoginRequest = z.infer<typeof SteamLoginRequestSchema>;

/** Session returned after signing in. */
export const AuthTokensSchema = z.object({
  accessToken: z.string().min(1),
  /** Seconds until the access token expires. */
  expiresIn: z.number().int().positive(),
});

export type AuthTokens = z.infer<typeof AuthTokensSchema>;

/** Response of GET /api/me: the signed-in user. */
export const MeSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  locale: LanguageSchema,
  steamId: z.string().nullable(),
});

export type Me = z.infer<typeof MeSchema>;
