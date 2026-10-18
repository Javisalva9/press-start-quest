import { RecommendationsService } from './recommendations.service.js';

const NOW = new Date('2026-10-18T12:00:00Z');
const H = 60;

const entry = (
  id: string,
  game: Record<string, unknown> = {},
  own: Record<string, unknown> = {},
) => ({
  id,
  gameId: `g-${id}`,
  playtimeMin: 0,
  lastPlayedAt: null,
  typeOverride: null,
  serverOverride: null,
  ...own,
  game: {
    title: id,
    coverUrl: null,
    heroUrl: null,
    steamAppId: null,
    ttbMainMin: 15 * H,
    ttbExtraMin: null,
    rating: 80,
    ratingCount: 1000,
    metacritic: null,
    gameType: 'COMPLETABLE',
    serverStatus: 'UNKNOWN',
    serverClosedAt: null,
    tags: [{ tag: { name: 'Shooter' } }],
    ...game,
  },
});

describe('RecommendationsService', () => {
  const prisma = {
    userGame: { findMany: vi.fn() },
    curatorPick: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  };
  const service = new RecommendationsService(prisma as never);

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.curatorPick.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
  });

  it('only scores open games of the library', async () => {
    prisma.userGame.findMany.mockResolvedValue([]);
    await expect(service.next('u1', null, 0, NOW)).resolves.toEqual({
      mood: null,
      pick: null,
      alternatives: [],
      candidates: 0,
    });
    expect(prisma.userGame.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'u1',
          owned: true,
          hidden: false,
          status: { in: ['BACKLOG', 'PLAYING', 'ON_HOLD'] },
          OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: NOW } }],
          game: { kind: 'GAME' },
        },
      }),
    );
    // Nothing to score: no SQL.
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('leaves out endless games, closed servers and partly closed ones without a story', async () => {
    prisma.userGame.findMany.mockResolvedValue([
      entry('ok'),
      entry('endless', { gameType: 'ENDLESS' }),
      entry(
        'marked-completable',
        { gameType: 'ENDLESS' },
        { typeOverride: 'COMPLETABLE' },
      ),
      entry('closed', { serverStatus: 'CLOSED' }),
      entry('marked-closed', {}, { serverOverride: 'CLOSED' }),
      entry('partial-story', { serverStatus: 'PARTIAL' }),
      entry('partial-no-story', { serverStatus: 'PARTIAL', ttbMainMin: null }),
    ]);
    const { items } = await service.ranking('u1', null, 50, NOW);
    expect(items.map((item) => item.id).sort()).toEqual([
      'marked-completable',
      'ok',
      'partial-story',
    ]);
  });

  it("compares affinity with the backlog's best fit", async () => {
    prisma.userGame.findMany.mockResolvedValue([
      entry('best'),
      entry('half'),
      entry('none'),
    ]);
    prisma.$queryRaw.mockResolvedValue([
      { gameId: 'g-best', raw: 4, topTag: 'Horror', topKind: 'THEME' },
      { gameId: 'g-half', raw: 2, topTag: 'Horror', topKind: 'THEME' },
      { gameId: 'g-none', raw: -1, topTag: null, topKind: null },
    ]);
    const { items } = await service.ranking('u1', null, 50, NOW);
    const affinity = Object.fromEntries(
      items.map((item) => [item.id, item.factors.affinity]),
    );
    expect(affinity).toEqual({ best: 1, half: 0.5, none: 0 });
    expect(items[0]!.reasons[0]).toEqual({
      code: 'TASTE_MATCH',
      tag: 'Horror',
      kind: 'THEME',
    });
  });

  it('counts only followed curators, and says who', async () => {
    prisma.userGame.findMany.mockResolvedValue([
      entry('picked'),
      entry('plain'),
    ]);
    prisma.curatorPick.findMany.mockResolvedValue([
      { gameId: 'g-picked', curator: { name: 'AlexElCapso' } },
    ]);
    const { items } = await service.ranking('u1', null, 50, NOW);
    expect(prisma.curatorPick.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          curator: { followers: { some: { userId: 'u1' } } },
        }),
      }),
    );
    expect(items[0]).toMatchObject({ id: 'picked', factors: { social: 1 } });
    expect(items[0]!.reasons).toContainEqual({
      code: 'RECOMMENDED_BY',
      curator: 'AlexElCapso',
    });
  });

  it('uses the player estimate when there is no main story length', async () => {
    prisma.userGame.findMany.mockResolvedValue([
      entry('manual', { ttbMainMin: null, ttbExtraMin: 8 * H }),
    ]);
    const { items } = await service.ranking('u1', 'short', 50, NOW);
    expect(items[0]).toMatchObject({ id: 'manual', remainingMinutes: 8 * H });
  });

  it('only offers games of the mood length', async () => {
    prisma.userGame.findMany.mockResolvedValue([
      entry('short', { ttbMainMin: 6 * H }),
      entry('long', { ttbMainMin: 60 * H }),
      entry('unknown', { ttbMainMin: null }),
    ]);
    const next = await service.next('u1', 'short', 0, NOW);
    expect(next).toMatchObject({
      mood: 'short',
      candidates: 1,
      pick: { id: 'short' },
    });
  });

  it('skips to the next for "another one", going round after the last', async () => {
    prisma.userGame.findMany.mockResolvedValue([
      entry('a', { rating: 95 }),
      entry('b', { rating: 85 }),
      entry('c', { rating: 75 }),
    ]);
    expect((await service.next('u1', null, 0, NOW)).pick?.id).toBe('a');
    expect((await service.next('u1', null, 1, NOW)).pick?.id).toBe('b');
    expect((await service.next('u1', null, 3, NOW)).pick?.id).toBe('a');
  });

  it('offers alternatives of other genres', async () => {
    prisma.userGame.findMany.mockResolvedValue([
      entry('shooter', { rating: 95 }),
      entry('shooter2', { rating: 90 }),
      entry('rpg', {
        rating: 85,
        tags: [{ tag: { name: 'Role-playing (RPG)' } }],
      }),
      entry('puzzle', { rating: 75, tags: [{ tag: { name: 'Puzzle' } }] }),
    ]);
    const next = await service.next('u1', null, 0, NOW);
    expect(next.pick?.id).toBe('shooter');
    expect(next.alternatives.map((game) => game.id)).toEqual(['rpg', 'puzzle']);
    expect(next.candidates).toBe(4);
  });
});
