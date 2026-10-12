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

/** Session returned after signing in or refreshing it. */
export const AuthTokensSchema = z.object({
  /** Short-lived token sent with every request: `Authorization: Bearer …`. */
  accessToken: z.string().min(1),
  /** Seconds until the access token expires. */
  expiresIn: z.number().int().positive(),
  /** Long-lived token used only to get new tokens. Single use. */
  refreshToken: z.string().min(1),
});

export type AuthTokens = z.infer<typeof AuthTokensSchema>;

/** Body of POST /api/auth/refresh and POST /api/auth/logout. */
export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1).max(200),
});

export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

/** Response of GET /api/me: the signed-in user. */
export const MeSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  locale: LanguageSchema,
  steamId: z.string().nullable(),
});

export type Me = z.infer<typeof MeSchema>;
