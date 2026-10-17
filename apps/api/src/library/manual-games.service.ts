import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AddManualGameRequest,
  ApiError,
  GameSearchResult,
  LibraryGame,
} from '@psq/shared';
import { autoStatus } from '../catalog/auto-status.js';
import { buildGameTags, buildGameUpdate } from '../catalog/game-metadata.js';
import { saveGameTags } from '../catalog/game-tags.js';
import { classifyGameType } from '../catalog/game-type.js';
import { igdbGameSlug, steamGameSlug } from '../catalog/slug.js';
import {
  GameStatus,
  type GameType,
  Platform,
  Prisma,
  StatusSource,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IgdbApi } from '../providers/igdb/igdb-api.js';
import { LibraryService } from './library.service.js';

/**
 * Games the player adds by hand, found on IGDB: wished for ("I want it")
 * or owned somewhere the app doesn't sync (an external source such as
 * "Jack Sparrow", or Epic until it gets its own sync).
 */
@Injectable()
export class ManualGamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly igdb: IgdbApi,
    private readonly library: LibraryService,
  ) {}

  /** PC games on IGDB, each marked if it's already in the library. */
  async search(userId: string, text: string): Promise<GameSearchResult[]> {
    const results = await this.fromIgdb(() => this.igdb.searchPcGames(text));
    const inLibrary = await this.prisma.userGame.findMany({
      where: {
        userId,
        game: { igdbId: { in: results.map((result) => result.igdbId) } },
      },
      select: { owned: true, game: { select: { igdbId: true } } },
    });
    const state = new Map(
      inLibrary.map((entry) => [
        entry.game.igdbId,
        entry.owned ? ('owned' as const) : ('wishlist' as const),
      ]),
    );
    return results.map((result) => ({
      ...result,
      inLibrary: state.get(result.igdbId) ?? null,
    }));
  }

  async add(userId: string, body: AddManualGameRequest): Promise<LibraryGame> {
    const game = await this.catalogGame(body.igdbId);
    const existing = await this.prisma.userGame.findUnique({
      where: { userId_gameId: { userId, gameId: game.id } },
      select: {
        id: true,
        owned: true,
        status: true,
        statusSource: true,
        completedAt: true,
        typeOverride: true,
      },
    });

    if (body.origin === 'wishlist') {
      if (existing?.owned) {
        throw new ConflictException({
          statusCode: 409,
          code: 'LIBRARY_GAME_ALREADY_OWNED',
        } satisfies ApiError);
      }
      // Already wished for: nothing to do.
      const id =
        existing?.id ??
        (
          await this.prisma.userGame.create({
            data: {
              userId,
              gameId: game.id,
              owned: false,
              status: GameStatus.WISHLIST,
              // The Steam wishlist sync never removes what was added by hand.
              addedManually: true,
            },
            select: { id: true },
          })
        ).id;
      return this.library.get(userId, id);
    }

    // Owned in an external source: the game, its source and its playtime.
    const source = await this.externalSource(userId, body.sourceName);
    const id =
      existing?.id ??
      (
        await this.prisma.userGame.create({
          data: { userId, gameId: game.id, owned: true, addedManually: true },
          select: { id: true },
        })
      ).id;
    const externalAppId = String(body.igdbId);
    await this.prisma.ownership.upsert({
      where: { sourceId_externalAppId: { sourceId: source.id, externalAppId } },
      create: {
        userGameId: id,
        sourceId: source.id,
        externalAppId,
        playtimeMin: body.playtimeMinutes ?? 0,
      },
      // Added again: only the playtime changes, and only if given.
      update:
        body.playtimeMinutes === undefined
          ? {}
          : { playtimeMin: body.playtimeMinutes },
    });

    // Playtime summed over every store, as the sync does.
    const totals = await this.prisma.ownership.aggregate({
      where: { userGameId: id },
      _sum: { playtimeMin: true },
      _max: { lastPlayedAt: true },
    });
    const playtimeMin = totals._sum.playtimeMin ?? 0;
    const lastPlayedAt = totals._max.lastPlayedAt;

    const now = new Date();
    let status: Prisma.UserGameUpdateInput = {};
    if (body.status) {
      status = {
        status: body.status,
        statusSource: StatusSource.MANUAL,
        completedAt:
          body.status === GameStatus.COMPLETED
            ? existing?.status === GameStatus.COMPLETED && existing.completedAt
              ? existing.completedAt
              : now
            : null,
      };
    } else if (
      !existing ||
      !existing.owned ||
      existing.statusSource === StatusSource.AUTO
    ) {
      // New, wished for until now, or automatic: the app works it out.
      status = {
        status: autoStatus(
          {
            playtimeMin,
            lastPlayedAt,
            gameType: existing?.typeOverride ?? game.gameType,
          },
          now,
        ),
        statusSource: StatusSource.AUTO,
        completedAt: null,
      };
    }

    await this.prisma.userGame.update({
      where: { id },
      data: { owned: true, playtimeMin, lastPlayedAt, ...status },
    });
    return this.library.get(userId, id);
  }

  /**
   * The catalog's game for an IGDB id: the one already there, or a new one
   * filled from IGDB. If IGDB knows its Steam page, the game gets that
   * appid, so it's the same game when Steam brings it later (bought, or in
   * someone else's library) instead of a duplicate.
   */
  private async catalogGame(
    igdbId: number,
  ): Promise<{ id: string; gameType: GameType }> {
    const select = { id: true, gameType: true } as const;
    const known = await this.prisma.game.findUnique({
      where: { igdbId },
      select,
    });
    if (known) {
      return known;
    }

    const [details, steamAppIds, timesToBeat] = await this.fromIgdb(() =>
      Promise.all([
        this.igdb.getGames([igdbId]),
        this.igdb.findSteamAppIds([igdbId]),
        this.igdb.getTimesToBeat([igdbId]),
      ]),
    );
    const igdb = details[0];
    if (!igdb) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'IGDB_GAME_NOT_FOUND',
      } satisfies ApiError);
    }
    const steamAppId = steamAppIds.get(igdbId) ?? null;
    if (steamAppId !== null) {
      // Already in the catalog from someone's Steam library. It gets its
      // IGDB id now if it had none yet, so the search finds it at once;
      // no other game has it (looked up first).
      const fromSteam = await this.prisma.game.findUnique({
        where: { steamAppId },
        select: { ...select, igdbId: true },
      });
      if (fromSteam) {
        if (fromSteam.igdbId === null) {
          await this.prisma.game.update({
            where: { id: fromSteam.id },
            data: { igdbId },
          });
        }
        return { id: fromSteam.id, gameType: fromSteam.gameType };
      }
    }

    const sources = {
      store: null,
      igdb,
      timeToBeat: timesToBeat[0] ?? null,
    };
    const update = buildGameUpdate(
      { title: igdb.title, ttbSource: null },
      sources,
    );
    const { type } = classifyGameType({
      modes: igdb.modes,
      genres: igdb.genres,
      themes: igdb.themes,
      storeCategories: [],
      ttbMainMin: update.ttbMainMin ?? null,
    });
    try {
      const game = await this.prisma.game.create({
        data: {
          ...update,
          title: igdb.title,
          slug:
            steamAppId === null
              ? igdbGameSlug(igdb.title, igdbId)
              : steamGameSlug(igdb.title, steamAppId),
          igdbId,
          steamAppId,
          gameType: type,
          // With a Steam page, the next sync adds the store's data (header
          // image, categories); without one, IGDB is all there is.
          metadataAt: steamAppId === null ? new Date() : null,
        },
        select,
      });
      await saveGameTags(this.prisma, [[game.id, buildGameTags(sources)]]);
      return game;
    } catch (error) {
      // Someone added the same game a moment ago.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.game.findUniqueOrThrow({
          where: { igdbId },
          select,
        });
      }
      throw error;
    }
  }

  /** The player's external source with that name (any case), or a new one. */
  private async externalSource(userId: string, name: string) {
    const existing = await this.prisma.source.findFirst({
      where: {
        userId,
        platform: Platform.EXTERNAL,
        displayName: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    return (
      existing ??
      this.prisma.source.create({
        data: {
          userId,
          platform: Platform.EXTERNAL,
          // No account behind it: any unique id will do.
          externalId: randomUUID(),
          displayName: name,
        },
        select: { id: true },
      })
    );
  }

  /** IGDB down or refusing: a clear error instead of a 500. */
  private async fromIgdb<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch {
      throw new BadGatewayException({
        statusCode: 502,
        code: 'IGDB_UNAVAILABLE',
      } satisfies ApiError);
    }
  }
}
