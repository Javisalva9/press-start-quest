import { LibraryQuerySchema } from '@psq/shared';
import { buildLibraryOrderBy, buildLibraryWhere } from './library-query.js';

const query = (raw: Record<string, string> = {}) =>
  LibraryQuerySchema.parse(raw);

describe('buildLibraryWhere', () => {
  it('shows only owned, visible games by default', () => {
    expect(buildLibraryWhere('u1', query())).toEqual({
      userId: 'u1',
      owned: true,
      hidden: false,
      game: { kind: 'GAME' },
    });
  });

  it('shows the wishlist entries in the wishlist view', () => {
    expect(buildLibraryWhere('u1', query({ view: 'wishlist' })).owned).toBe(
      false,
    );
  });

  it('combines status, store and text filters', () => {
    expect(
      buildLibraryWhere(
        'u1',
        query({ status: 'BACKLOG,PLAYING', source: 'STEAM', q: 'portal' }),
      ),
    ).toEqual({
      userId: 'u1',
      owned: true,
      hidden: false,
      game: {
        kind: 'GAME',
        title: { contains: 'portal', mode: 'insensitive' },
      },
      status: { in: ['BACKLOG', 'PLAYING'] },
      ownerships: { some: { source: { platform: 'STEAM' } } },
    });
  });

  it('filters by length with the main story as a fallback', () => {
    expect(buildLibraryWhere('u1', query({ length: 'short' })).game).toEqual({
      kind: 'GAME',
      OR: [
        { ttbExtraMin: { lt: 600 } },
        { ttbExtraMin: null, ttbMainMin: { lt: 600 } },
      ],
    });
  });

  it('finds games with no known length', () => {
    expect(buildLibraryWhere('u1', query({ length: 'unknown' })).game).toEqual({
      kind: 'GAME',
      ttbExtraMin: null,
      ttbMainMin: null,
    });
  });
});

describe('buildLibraryOrderBy', () => {
  it('puts the most recently played first, never-played last', () => {
    expect(buildLibraryOrderBy('lastPlayed')).toEqual([
      { lastPlayedAt: { sort: 'desc', nulls: 'last' } },
      { game: { title: 'asc' } },
    ]);
  });

  it('always breaks ties by title so pages are stable', () => {
    for (const sort of [
      'title',
      'playtime',
      'rating',
      'length',
      'added',
      'priority',
    ] as const) {
      expect(buildLibraryOrderBy(sort).at(-1)).toEqual({
        game: { title: 'asc' },
      });
    }
  });
});
