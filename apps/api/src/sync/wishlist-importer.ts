import { Injectable, Logger } from '@nestjs/common';
import { classifyGameKind } from '../catalog/game-kind.js';
import { steamGameSlug } from '../catalog/slug.js';
import {
  GameStatus,
  Platform,
  StatusSource,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { WishlistGame } from '../providers/library-provider.js';
import { SteamLibraryProvider } from '../providers/steam/steam-library.provider.js';
import { SteamStoreApi } from '../providers/steam/steam-store-api.js';
import { SyncError } from './sync-error.js';

/**
 * Imports the Steam wishlist as "Lo quiero": library entries the user
 * doesn't own yet (owned = false, status WISHLIST), with Steam's priority.
 *
 * It runs right after the library import succeeded, so the game details
 * (which include the wishlist) are public: an empty wishlist really is
 * empty, and removing the entries that left it is safe.
 */
@Injectable()
export class WishlistImporter {
  private readonly logger = new Logger(WishlistImporter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly steam: SteamLibraryProvider,
    private readonly store: SteamStoreApi,
  ) {}

  /** `onProgress` receives how much is done, from 0 to 1. */
  async importSteam(
    userId: string,
    onProgress: (fraction: number) => Promise<void>,
  ): Promise<{ wishlistItems: number }> {
    const source = await this.prisma.source.findFirst({
      where: { userId, platform: Platform.STEAM },
      select: { externalId: true },
    });
    if (!source) {
      throw new SyncError('STEAM_ACCOUNT_NOT_LINKED');
    }
    let wishlist: WishlistGame[];
    try {
      wishlist = await this.steam.getWishlist(source.externalId);
    } catch (error) {
      throw new SyncError('STEAM_UNAVAILABLE', { cause: error });
    }
    const appIds = wishlist.map((item) => Number(item.externalAppId));

    // 1. Wished games new to the catalog: the wishlist only has appids, so
    //    the name comes from the store (whose answer the enrichment reuses).
    const known = await this.prisma.game.findMany({
      where: { steamAppId: { in: appIds } },
      select: { steamAppId: true },
    });
    const knownAppIds = new Set(known.map((game) => game.steamAppId));
    const missing = appIds.filter((appId) => !knownAppIds.has(appId));
    let done = 0;
    const newGames = await Promise.all(
      missing.map(async (appId) => {
        try {
          const details = await this.store.getAppDetails(appId);
          return details
            ? {
                title: details.name,
                slug: steamGameSlug(details.name, appId),
                steamAppId: appId,
                kind: classifyGameKind({
                  title: details.name,
                  storeType: details.type,
                }),
              }
            : null;
        } catch (error) {
          // Left out this time; the next sync tries again.
          this.logger.warn(
            `Steam Store failed for wished appid ${appId}: ${(error as Error).message}`,
          );
          return null;
        } finally {
          done += 1;
          await onProgress((0.8 * done) / missing.length);
        }
      }),
    );
    await this.prisma.game.createMany({
      data: newGames.filter((game) => game !== null),
      skipDuplicates: true,
    });

    // 2. The user's "Lo quiero" entries.
    const games = await this.prisma.game.findMany({
      where: { steamAppId: { in: appIds } },
      select: { id: true, steamAppId: true },
    });
    const gameIdByAppId = new Map(
      games.map((game) => [String(game.steamAppId), game.id]),
    );
    const wished = wishlist.flatMap((item) => {
      const gameId = gameIdByAppId.get(item.externalAppId);
      return gameId ? [{ ...item, gameId }] : [];
    });

    // Games already in the library (owned) are left alone.
    await this.prisma.userGame.createMany({
      data: wished.map((item) => ({
        userId,
        gameId: item.gameId,
        owned: false,
        status: GameStatus.WISHLIST,
        wishlistPriority: item.priority,
        wishlistedAt: item.addedAt,
      })),
      skipDuplicates: true,
    });
    // Priorities change when the user reorders the wishlist.
    const current = await this.prisma.userGame.findMany({
      where: {
        userId,
        owned: false,
        gameId: { in: wished.map((item) => item.gameId) },
      },
      select: { id: true, gameId: true, wishlistPriority: true },
    });
    const priorityOf = new Map(
      wished.map((item) => [item.gameId, item.priority]),
    );
    const reordered = current.filter(
      (entry) => entry.wishlistPriority !== priorityOf.get(entry.gameId),
    );
    if (reordered.length > 0) {
      await this.prisma.$transaction(
        reordered.map((entry) =>
          this.prisma.userGame.update({
            where: { id: entry.id },
            data: { wishlistPriority: priorityOf.get(entry.gameId) ?? null },
          }),
        ),
      );
    }

    // 3. Removed from the Steam wishlist without buying it: it leaves
    //    "Lo quiero", unless the user added it or chose its status by hand,
    //    or a followed curator's list brought it (it was never on Steam).
    await this.prisma.userGame.deleteMany({
      where: {
        userId,
        owned: false,
        status: GameStatus.WISHLIST,
        statusSource: StatusSource.AUTO,
        addedManually: false,
        addedByCuratorId: null,
        gameId: { notIn: wished.map((item) => item.gameId) },
      },
    });

    return { wishlistItems: wished.length };
  }
}
