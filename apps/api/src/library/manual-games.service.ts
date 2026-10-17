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
import {
  IgdbCatalog,
  IgdbUnavailableError,
  type CatalogEntry,
} from '../catalog/igdb-catalog.service.js';
import {
  GameStatus,
  Platform,
  type Prisma,
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
    private readonly catalog: IgdbCatalog,
  ) {}

  /** PC games on IGDB, each marked if it's already in the library. */
  async search(userId: string, text: string): Promise<GameSearchResult[]> {
    const results = await this.fromIgdb(() => this.igdb.searchPcGames(text));
    const inLibrary = await this.prisma.userGame.findMany({
      where: {
        userId,
        // Removed from "Lo quiero" (hidden): as if it weren't there.
        hidden: false,
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
        hidden: true,
      },
    });

    if (body.origin === 'wishlist') {
      if (existing?.owned) {
        throw new ConflictException({
          statusCode: 409,
          code: 'LIBRARY_GAME_ALREADY_OWNED',
        } satisfies ApiError);
      }
      // Removed from "Lo quiero" earlier: adding it by hand brings it back.
      if (existing?.hidden) {
        await this.prisma.userGame.update({
          where: { id: existing.id },
          data: { hidden: false },
        });
      }
      // Already wished for: nothing else to do.
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
      // Owned now: shown, even if it had been removed from "Lo quiero".
      data: {
        owned: true,
        hidden: false,
        playtimeMin,
        lastPlayedAt,
        ...status,
      },
    });
    return this.library.get(userId, id);
  }

  /** The catalog's game for an IGDB id, created from IGDB if missing. */
  private async catalogGame(igdbId: number): Promise<CatalogEntry> {
    let found: Map<number, CatalogEntry>;
    try {
      found = await this.catalog.ensure([igdbId]);
    } catch (error) {
      if (error instanceof IgdbUnavailableError) {
        throw igdbUnavailable();
      }
      throw error;
    }
    const game = found.get(igdbId);
    if (!game) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'IGDB_GAME_NOT_FOUND',
      } satisfies ApiError);
    }
    return game;
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
      throw igdbUnavailable();
    }
  }
}

function igdbUnavailable(): BadGatewayException {
  return new BadGatewayException({
    statusCode: 502,
    code: 'IGDB_UNAVAILABLE',
  } satisfies ApiError);
}
