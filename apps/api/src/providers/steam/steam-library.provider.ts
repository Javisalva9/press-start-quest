import { Injectable } from '@nestjs/common';
import { Platform } from '../../generated/prisma/client.js';
import type {
  LibraryAchievement,
  LibraryGame,
  LibraryProvider,
  WishlistGame,
} from '../library-provider.js';
import { SteamWebApi } from './steam-web-api.js';

/** Steam, seen through the common provider interface. */
@Injectable()
export class SteamLibraryProvider implements LibraryProvider {
  readonly platform = Platform.STEAM;

  constructor(private readonly steam: SteamWebApi) {}

  async getLibrary(steamId: string): Promise<LibraryGame[] | null> {
    const owned = await this.steam.getOwnedGames(steamId);
    if (!owned) {
      return null;
    }
    return owned.games.map((game) => ({
      externalAppId: String(game.appId),
      title: game.name,
      playtimeMinutes: game.playtimeMinutes,
      recentPlaytimeMinutes: game.playtimeTwoWeeksMinutes,
      lastPlayedAt: game.lastPlayedAt,
    }));
  }

  async getAchievements(
    steamId: string,
    externalAppId: string,
  ): Promise<LibraryAchievement[] | null> {
    const achievements = await this.steam.getPlayerAchievements(
      steamId,
      toAppId(externalAppId),
    );
    return (
      achievements?.map((achievement) => ({
        id: achievement.apiName,
        name: achievement.name,
        description: achievement.description,
        unlockedAt: achievement.unlockedAt,
      })) ?? null
    );
  }

  async getWishlist(steamId: string): Promise<WishlistGame[]> {
    const items = await this.steam.getWishlist(steamId);
    return (
      items
        .map((item) => ({
          externalAppId: String(item.appId),
          // Steam ranks from 1 (most wanted); 0 means "not ranked".
          priority: item.priority && item.priority > 0 ? item.priority : null,
          addedAt: item.addedAt,
        }))
        // Ranked wishes first, by rank; then the rest, newest first.
        .sort(
          (a, b) =>
            (a.priority ?? Infinity) - (b.priority ?? Infinity) ||
            (b.addedAt?.getTime() ?? 0) - (a.addedAt?.getTime() ?? 0),
        )
    );
  }
}

function toAppId(externalAppId: string): number {
  const appId = Number(externalAppId);
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new Error(`Not a Steam appid: ${externalAppId}`);
  }
  return appId;
}
