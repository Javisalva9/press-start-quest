import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ApiError,
  LibraryGame,
  LibraryItem,
  LibraryPage,
  LibraryQuery,
  RecommendedBy,
  UpdateLibraryGameRequest,
} from '@psq/shared';
import { autoStatus } from '../catalog/auto-status.js';
import {
  GameStatus,
  StatusSource,
  TagKind,
  type Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildLibraryOrderBy, buildLibraryWhere } from './library-query.js';

/** What the list needs from each entry: nothing more is read. */
const listSelect = {
  id: true,
  gameId: true,
  status: true,
  owned: true,
  playtimeMin: true,
  lastPlayedAt: true,
  achievementsUnlocked: true,
  achievementsTotal: true,
  wishlistPriority: true,
  game: {
    select: {
      title: true,
      coverUrl: true,
      heroUrl: true,
      rating: true,
      ttbMainMin: true,
      ttbExtraMin: true,
    },
  },
  ownerships: { select: { source: { select: { platform: true } } } },
} satisfies Prisma.UserGameSelect;

type ListRow = Prisma.UserGameGetPayload<{ select: typeof listSelect }>;

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: LibraryQuery): Promise<LibraryPage> {
    const where = buildLibraryWhere(userId, query);
    // The page and the total, in one round trip to the database.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.userGame.findMany({
        where,
        orderBy: buildLibraryOrderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: listSelect,
      }),
      this.prisma.userGame.count({ where }),
    ]);
    const labels = await this.recommendedBy(
      userId,
      rows.map((row) => row.gameId),
    );
    return {
      items: rows.map((row) => toLibraryItem(row, labels.get(row.gameId))),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * Sets the "normal" length of a game by hand, or clears it (null) so the
   * next sync takes IGDB's again. A manual length is never overwritten by
   * a sync (see buildGameUpdate).
   */
  async setLength(
    userId: string,
    id: string,
    minutes: number | null,
  ): Promise<LibraryGame> {
    const entry = await this.prisma.userGame.findFirst({
      where: { id, userId },
      select: { gameId: true },
    });
    if (!entry) {
      throw notFound();
    }
    await this.prisma.game.update({
      where: { id: entry.gameId },
      data:
        minutes === null
          ? // Back to IGDB: the next sync enriches this game again.
            { ttbExtraMin: null, ttbSource: null, metadataAt: null }
          : { ttbExtraMin: minutes, ttbSource: 'manual' },
    });
    return this.get(userId, id);
  }

  /**
   * The player's own word on a game: status, type and servers. Their value
   * always wins over the app's; null hands each one back to the app. The
   * automatic status is worked out at once, so the page shows it without
   * waiting for the next sync.
   */
  async update(
    userId: string,
    id: string,
    body: UpdateLibraryGameRequest,
  ): Promise<LibraryGame> {
    const entry = await this.prisma.userGame.findFirst({
      where: { id, userId },
      select: {
        owned: true,
        status: true,
        statusSource: true,
        completedAt: true,
        playtimeMin: true,
        lastPlayedAt: true,
        typeOverride: true,
        game: { select: { gameType: true } },
      },
    });
    if (!entry) {
      throw notFound();
    }
    if (body.status !== undefined && !entry.owned) {
      // A wishlisted game's status comes from the store: "I want it".
      throw new ConflictException({
        statusCode: 409,
        code: 'LIBRARY_GAME_NOT_OWNED',
      } satisfies ApiError);
    }

    const data: Prisma.UserGameUpdateInput = {};
    if (body.gameType !== undefined) {
      data.typeOverride = body.gameType;
    }
    if (body.serverStatus !== undefined) {
      data.serverOverride = body.serverStatus;
    }

    const now = new Date();
    if (body.status) {
      Object.assign(data, {
        status: body.status,
        statusSource: StatusSource.MANUAL,
        // Keep the first completion date if it was already completed.
        completedAt:
          body.status === GameStatus.COMPLETED
            ? entry.status === GameStatus.COMPLETED && entry.completedAt
              ? entry.completedAt
              : now
            : null,
      });
    } else if (
      entry.owned &&
      (body.status === null || entry.statusSource === StatusSource.AUTO)
    ) {
      // Back to automatic, or still automatic: the type may have just
      // changed (an endless game is never "on hold").
      const type =
        (body.gameType !== undefined ? body.gameType : entry.typeOverride) ??
        entry.game.gameType;
      Object.assign(data, {
        status: autoStatus(
          {
            playtimeMin: entry.playtimeMin,
            lastPlayedAt: entry.lastPlayedAt,
            gameType: type,
          },
          now,
        ),
        statusSource: StatusSource.AUTO,
        completedAt: null,
      });
    }

    await this.prisma.userGame.update({ where: { id }, data });
    return this.get(userId, id);
  }

  /**
   * Takes a game out of "Lo quiero". It's hidden, not deleted: deleted, it
   * would come back with the next load of a followed curator's list.
   */
  async removeFromWishlist(userId: string, id: string): Promise<void> {
    const entry = await this.prisma.userGame.findFirst({
      where: { id, userId },
      select: { owned: true, status: true },
    });
    if (!entry) {
      throw notFound();
    }
    if (entry.owned || entry.status !== GameStatus.WISHLIST) {
      throw new ConflictException({
        statusCode: 409,
        code: entry.owned
          ? 'LIBRARY_GAME_ALREADY_OWNED'
          : 'LIBRARY_GAME_NOT_WISHED',
      } satisfies ApiError);
    }
    await this.prisma.userGame.update({
      where: { id },
      data: { hidden: true },
    });
  }

  /** The followed curators that recommend each game: gameId → labels. */
  private async recommendedBy(
    userId: string,
    gameIds: string[],
  ): Promise<Map<string, RecommendedBy[]>> {
    const picks = await this.prisma.curatorPick.findMany({
      where: {
        gameId: { in: gameIds },
        curator: { followers: { some: { userId } } },
      },
      select: {
        gameId: true,
        curator: { select: { name: true, color: true } },
      },
      orderBy: { curator: { name: 'asc' } },
    });
    const labels = new Map<string, RecommendedBy[]>();
    for (const { gameId, curator } of picks) {
      labels.set(gameId, [...(labels.get(gameId) ?? []), curator]);
    }
    return labels;
  }

  async get(userId: string, id: string): Promise<LibraryGame> {
    const row = await this.prisma.userGame.findFirst({
      // userId in the filter: another user's entry is simply "not found".
      where: { id, userId },
      select: {
        ...listSelect,
        statusSource: true,
        typeOverride: true,
        serverOverride: true,
        game: {
          select: {
            ...listSelect.game.select,
            gameType: true,
            serverStatus: true,
            serverClosedAt: true,
            summary: true,
            developer: true,
            releaseDate: true,
            ratingCount: true,
            metacritic: true,
            steamAppId: true,
            ttbCompleteMin: true,
            ttbSource: true,
            tags: { select: { tag: { select: { name: true, kind: true } } } },
          },
        },
        ownerships: {
          select: {
            playtimeMin: true,
            lastPlayedAt: true,
            source: { select: { platform: true, displayName: true } },
          },
        },
      },
    });
    if (!row) {
      throw notFound();
    }

    const { game } = row;
    const tagsOf = (kind: TagKind) =>
      game.tags
        .filter(({ tag }) => tag.kind === kind)
        .map(({ tag }) => tag.name);
    const labels = await this.recommendedBy(userId, [row.gameId]);
    return {
      ...toLibraryItem(row, labels.get(row.gameId)),
      summary: game.summary,
      developer: game.developer,
      releaseDate: game.releaseDate?.toISOString() ?? null,
      ratingCount: game.ratingCount,
      metacritic: game.metacritic,
      steamAppId: game.steamAppId,
      timeToBeat: {
        mainMinutes: game.ttbMainMin,
        extraMinutes: game.ttbExtraMin,
        completeMinutes: game.ttbCompleteMin,
        source: game.ttbSource,
      },
      genres: tagsOf(TagKind.GENRE),
      themes: tagsOf(TagKind.THEME),
      modes: tagsOf(TagKind.MODE),
      perspectives: tagsOf(TagKind.PERSPECTIVE),
      statusSource: row.statusSource,
      automaticStatus: row.owned
        ? autoStatus(
            {
              playtimeMin: row.playtimeMin,
              lastPlayedAt: row.lastPlayedAt,
              gameType: row.typeOverride ?? game.gameType,
            },
            new Date(),
          )
        : GameStatus.WISHLIST,
      gameType: {
        catalog: game.gameType,
        override: pickable(row.typeOverride),
      },
      serverStatus: {
        catalog: game.serverStatus,
        override: pickable(row.serverOverride),
        closedAt: game.serverClosedAt?.toISOString() ?? null,
      },
      ownerships: row.ownerships.map((ownership) => ({
        platform: ownership.source.platform,
        sourceName:
          ownership.source.platform === 'EXTERNAL'
            ? ownership.source.displayName
            : null,
        playtimeMinutes: ownership.playtimeMin,
        lastPlayedAt: ownership.lastPlayedAt?.toISOString() ?? null,
      })),
    };
  }
}

/** Overrides are never UNKNOWN (the API doesn't accept it), but the column could say so. */
function pickable<T extends string>(
  value: T | null,
): Exclude<T, 'UNKNOWN'> | null {
  return value === null || value === 'UNKNOWN'
    ? null
    : (value as Exclude<T, 'UNKNOWN'>);
}

function notFound(): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    code: 'LIBRARY_GAME_NOT_FOUND',
  } satisfies ApiError);
}

function toLibraryItem(
  row: ListRow,
  recommendedBy: RecommendedBy[] = [],
): LibraryItem {
  return {
    id: row.id,
    title: row.game.title,
    coverUrl: row.game.coverUrl,
    heroUrl: row.game.heroUrl,
    status: row.status,
    owned: row.owned,
    playtimeMinutes: row.playtimeMin,
    lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
    lengthMinutes: row.game.ttbExtraMin ?? row.game.ttbMainMin,
    rating: row.game.rating,
    achievements:
      row.achievementsTotal === null
        ? null
        : {
            unlocked: row.achievementsUnlocked ?? 0,
            total: row.achievementsTotal,
          },
    wishlistPriority: row.wishlistPriority,
    sources: [...new Set(row.ownerships.map(({ source }) => source.platform))],
    recommendedBy,
  };
}
