import { z } from 'zod';

/**
 * What Steam lets the app read from a profile:
 * - PUBLIC: library and playtime are readable.
 * - PROFILE_PRIVATE: the whole profile is private (or friends only).
 * - GAMES_PRIVATE: the profile is public but its game details are not.
 * - PLAYTIME_HIDDEN: games are readable but every playtime is 0, which is
 *   what "always keep my total playtime private" looks like.
 */
export const STEAM_PRIVACY_STATUSES = [
  'PUBLIC',
  'PROFILE_PRIVATE',
  'GAMES_PRIVATE',
  'PLAYTIME_HIDDEN',
] as const;

export const SteamPrivacyStatusSchema = z.enum(STEAM_PRIVACY_STATUSES);

export type SteamPrivacyStatus = z.infer<typeof SteamPrivacyStatusSchema>;

/** Response of GET /api/sources/steam/privacy. */
export const SteamPrivacySchema = z.object({
  status: SteamPrivacyStatusSchema,
  /** Games Steam reports, when the library is readable. */
  gameCount: z.number().int().nonnegative().nullable(),
});

export type SteamPrivacy = z.infer<typeof SteamPrivacySchema>;
