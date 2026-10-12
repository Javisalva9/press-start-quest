import type { Platform } from '../generated/prisma/client.js';

/** A game in an account's library, as the store reports it. */
export interface LibraryGame {
  /** Id of the game in that store: the Steam appid (as text), Epic's catalog id… */
  externalAppId: string;
  title: string;
  playtimeMinutes: number;
  /** Minutes played in the last two weeks (0 if the store doesn't say). */
  recentPlaytimeMinutes: number;
  lastPlayedAt: Date | null;
}

export interface LibraryAchievement {
  id: string;
  name: string;
  description: string;
  /** Null while it's still locked. */
  unlockedAt: Date | null;
}

export interface WishlistGame {
  externalAppId: string;
  /** 1 = most wanted. Null if the store doesn't rank it. */
  priority: number | null;
  addedAt: Date | null;
}

/**
 * What a game store must offer to be imported: Steam now, Epic in stage 5.
 * Sync and recommendations only talk to this interface, never to a store
 * directly, so adding a store means writing one more provider.
 *
 * `accountId` is the account in that store (the SteamID64 for Steam), the
 * same value stored in `sources.externalId`.
 */
export interface LibraryProvider {
  readonly platform: Platform;

  /** Games of an account, or null if the store won't share them (private). */
  getLibrary(accountId: string): Promise<LibraryGame[] | null>;

  /** Achievements of an account in one game, or null if the game has none. */
  getAchievements(
    accountId: string,
    externalAppId: string,
  ): Promise<LibraryAchievement[] | null>;

  /** Wishlist of an account, most wanted first. Empty if the store has none. */
  getWishlist(accountId: string): Promise<WishlistGame[]>;
}
