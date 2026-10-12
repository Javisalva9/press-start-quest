import { Injectable } from '@nestjs/common';
import type { SyncStats } from '@psq/shared';
import { classifyGameKind } from '../catalog/game-kind.js';
import { steamGameSlug } from '../catalog/slug.js';
import {
  GameKind,
  GameStatus,
  Platform,
  StatusSource,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LibraryGame } from '../providers/library-provider.js';
import { SteamLibraryProvider } from '../providers/steam/steam-library.provider.js';
import { diffOwnerships } from './library-diff.js';
import { SyncError } from './sync-error.js';

/**
 * Imports a user's Steam library into the database:
 * the shared catalog (`games`), the user's library (`user_games`) and
 * what they own in each store, with its playtime (`ownerships`).
 *
 * Writes in bulk (a few queries for the whole library, not a few per game)
 * and, after the first sync, only what changed.
 */
@Injectable()
export class LibraryImporter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly steam: SteamLibraryProvider,
  ) {}

  async importSteam(
    userId: string,
    onProgress: (progress: number) => Promise<void>,
  ): Promise<SyncStats> {
    const source = await this.prisma.source.findFirst({
      where: { userId, platform: Platform.STEAM },
      select: { id: true, externalId: true },
    });
    if (!source) {
      throw new SyncError('STEAM_ACCOUNT_NOT_LINKED');
    }

    let library: LibraryGame[] | null;
    try {
      library = await this.steam.getLibrary(source.externalId);
    } catch (error) {
      throw new SyncError('STEAM_UNAVAILABLE', { cause: error });
    }
    if (!library) {
      throw new SyncError('STEAM_LIBRARY_PRIVATE');
    }
    await onProgress(30);

    // 1. Shared catalog: one row per game, whoever owns it. Existing rows
    //    are left alone (skipDuplicates); enrichment keeps them up to date.
    await this.prisma.game.createMany({
      data: library.map((game) => ({
        title: game.title,
        slug: steamGameSlug(game.title, Number(game.externalAppId)),
        steamAppId: Number(game.externalAppId),
        kind: classifyGameKind({ title: game.title }),
      })),
      skipDuplicates: true,
    });
    const games = await this.prisma.game.findMany({
      where: {
        steamAppId: { in: library.map((game) => Number(game.externalAppId)) },
      },
      select: { id: true, steamAppId: true, kind: true },
    });
    const gameIdByAppId = new Map(
      games.map((game) => [String(game.steamAppId), game.id]),
    );
    const gameIds = games.map((game) => game.id);
    await onProgress(50);

    // 2. The user's library.
    await this.prisma.userGame.createMany({
      data: gameIds.map((gameId) => ({ userId, gameId })),
      skipDuplicates: true,
    });
    // Bought from the wishlist: it becomes a pending game, unless the user
    // chose its status themselves.
    await this.prisma.userGame.updateMany({
      where: {
        userId,
        gameId: { in: gameIds },
        status: GameStatus.WISHLIST,
        statusSource: StatusSource.AUTO,
      },
      data: { status: GameStatus.BACKLOG },
    });
    await this.prisma.userGame.updateMany({
      where: { userId, gameId: { in: gameIds }, owned: false },
      data: { owned: true },
    });
    const userGames = await this.prisma.userGame.findMany({
      where: { userId, gameId: { in: gameIds } },
      select: { id: true, gameId: true },
    });
    const userGameIdByGameId = new Map(
      userGames.map((userGame) => [userGame.gameId, userGame.id]),
    );
    const userGameIdOf = (game: LibraryGame): string => {
      const gameId = gameIdByAppId.get(game.externalAppId);
      const userGameId = gameId && userGameIdByGameId.get(gameId);
      if (!userGameId) {
        throw new Error(`No library entry for appid ${game.externalAppId}`);
      }
      return userGameId;
    };
    await onProgress(70);

    // 3. What the user owns on Steam, with its playtime.
    const stored = await this.prisma.ownership.findMany({
      where: { sourceId: source.id },
      select: {
        externalAppId: true,
        playtimeMin: true,
        playtime2wMin: true,
        lastPlayedAt: true,
      },
    });
    const { added, changed } = diffOwnerships(stored, library);
    await this.prisma.ownership.createMany({
      data: added.map((game) => ({
        userGameId: userGameIdOf(game),
        sourceId: source.id,
        externalAppId: game.externalAppId,
        playtimeMin: game.playtimeMinutes,
        playtime2wMin: game.recentPlaytimeMinutes,
        lastPlayedAt: game.lastPlayedAt,
      })),
      skipDuplicates: true,
    });
    if (changed.length > 0) {
      await this.prisma.$transaction(
        changed.map((game) =>
          this.prisma.ownership.update({
            where: {
              sourceId_externalAppId: {
                sourceId: source.id,
                externalAppId: game.externalAppId,
              },
            },
            data: {
              playtimeMin: game.playtimeMinutes,
              playtime2wMin: game.recentPlaytimeMinutes,
              lastPlayedAt: game.lastPlayedAt,
            },
          }),
        ),
      );
    }
    await onProgress(90);

    // 4. Playtime of each game summed over every store (Steam + Epic in
    //    stage 5), in a single query for all the games that changed.
    const touched = [...added, ...changed].map(userGameIdOf);
    if (touched.length > 0) {
      await this.prisma.$executeRaw`
        UPDATE "user_games" AS ug
        SET "playtimeMin" = totals.playtime,
            "lastPlayedAt" = totals.last_played,
            "updatedAt" = NOW()
        FROM (
          SELECT "userGameId",
                 SUM("playtimeMin")::int AS playtime,
                 MAX("lastPlayedAt") AS last_played
          FROM "ownerships"
          WHERE "userGameId" = ANY(${touched})
          GROUP BY "userGameId"
        ) AS totals
        WHERE ug."id" = totals."userGameId"`;
    }

    await this.prisma.source.update({
      where: { id: source.id },
      data: { lastSyncAt: new Date() },
    });

    return {
      gamesFound: library.length,
      gamesAdded: added.length,
      playtimeUpdated: changed.length,
      notGames: games.filter((game) => game.kind !== GameKind.GAME).length,
    };
  }
}
