import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApiError,
  LibraryGame,
  LibraryItem,
  LibraryPage,
  LibraryQuery,
} from '@psq/shared';
import { TagKind, type Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildLibraryOrderBy, buildLibraryWhere } from './library-query.js';

/** What the list needs from each entry: nothing more is read. */
const listSelect = {
  id: true,
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
    return {
      items: rows.map(toLibraryItem),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(userId: string, id: string): Promise<LibraryGame> {
    const row = await this.prisma.userGame.findFirst({
      // userId in the filter: another user's entry is simply "not found".
      where: { id, userId },
      select: {
        ...listSelect,
        game: {
          select: {
            ...listSelect.game.select,
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
            source: { select: { platform: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'LIBRARY_GAME_NOT_FOUND',
      } satisfies ApiError);
    }

    const { game } = row;
    const tagsOf = (kind: TagKind) =>
      game.tags
        .filter(({ tag }) => tag.kind === kind)
        .map(({ tag }) => tag.name);
    return {
      ...toLibraryItem(row),
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
      ownerships: row.ownerships.map((ownership) => ({
        platform: ownership.source.platform,
        playtimeMinutes: ownership.playtimeMin,
        lastPlayedAt: ownership.lastPlayedAt?.toISOString() ?? null,
      })),
    };
  }
}

function toLibraryItem(row: ListRow): LibraryItem {
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
  };
}
