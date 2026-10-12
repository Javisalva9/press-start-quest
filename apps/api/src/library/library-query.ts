import type { LengthBucket, LibraryQuery, LibrarySort } from '@psq/shared';
import { GameKind, type Prisma } from '../generated/prisma/client.js';

const HOUR = 60;

/**
 * "Normal" length of a game: main story + extras, or just the main story
 * when that's all there is. These filters mirror that rule.
 */
function lengthFilter(bucket: LengthBucket): Prisma.GameWhereInput {
  if (bucket === 'unknown') {
    return { ttbExtraMin: null, ttbMainMin: null };
  }
  const range: Prisma.IntFilter =
    bucket === 'short'
      ? { lt: 10 * HOUR }
      : bucket === 'medium'
        ? { gte: 10 * HOUR, lte: 30 * HOUR }
        : { gt: 30 * HOUR };
  return {
    OR: [{ ttbExtraMin: range }, { ttbExtraMin: null, ttbMainMin: range }],
  };
}

/** Prisma filter for GET /api/library. */
export function buildLibraryWhere(
  userId: string,
  query: LibraryQuery,
): Prisma.UserGameWhereInput {
  return {
    userId,
    owned: query.view === 'library',
    // Hidden by the user, or not a game at all (DLC, Playtests…).
    hidden: false,
    game: {
      kind: GameKind.GAME,
      ...(query.q && { title: { contains: query.q, mode: 'insensitive' } }),
      ...(query.length && lengthFilter(query.length)),
    },
    ...(query.status && { status: { in: query.status } }),
    ...(query.source && {
      ownerships: { some: { source: { platform: query.source } } },
    }),
  };
}

/**
 * Sort order. Empty values (never played, unknown length…) always go last,
 * and the title breaks ties so the order is stable between pages.
 */
export function buildLibraryOrderBy(
  sort: LibrarySort,
): Prisma.UserGameOrderByWithRelationInput[] {
  const byTitle = { game: { title: 'asc' } } as const;
  switch (sort) {
    case 'title':
      return [byTitle];
    case 'playtime':
      return [{ playtimeMin: 'desc' }, byTitle];
    case 'rating':
      return [{ game: { rating: { sort: 'desc', nulls: 'last' } } }, byTitle];
    case 'length':
      return [
        { game: { ttbExtraMin: { sort: 'asc', nulls: 'last' } } },
        { game: { ttbMainMin: { sort: 'asc', nulls: 'last' } } },
        byTitle,
      ];
    case 'added':
      return [{ createdAt: 'desc' }, byTitle];
    case 'priority':
      return [{ wishlistPriority: { sort: 'asc', nulls: 'last' } }, byTitle];
    case 'lastPlayed':
      return [{ lastPlayedAt: { sort: 'desc', nulls: 'last' } }, byTitle];
  }
}
