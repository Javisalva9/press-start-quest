import { Prisma } from '../generated/prisma/client.js';
import { ManualGamesService } from './manual-games.service.js';

const igdbGame = {
  igdbId: 7,
  title: 'Half-Life: Alyx',
  slug: 'half-life-alyx',
  summary: null,
  releaseDate: null,
  rating: 90,
  ratingCount: 100,
  coverUrl: 'https://images.igdb.com/cover.jpg',
  developer: 'Valve',
  genres: ['Shooter', 'Adventure'],
  themes: ['Science fiction'],
  modes: ['Single player'],
  perspectives: ['Virtual Reality'],
};

describe('ManualGamesService', () => {
  const prisma = {
    game: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    userGame: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ownership: { upsert: vi.fn(), aggregate: vi.fn() },
    source: { findFirst: vi.fn(), create: vi.fn() },
    tag: { createMany: vi.fn(), findMany: vi.fn() },
    gameTag: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const igdb = {
    searchPcGames: vi.fn(),
    getGames: vi.fn(),
    findSteamAppIds: vi.fn(),
    getTimesToBeat: vi.fn(),
  };
  const library = { get: vi.fn() };
  const service = new ManualGamesService(
    prisma as never,
    igdb as never,
    library as never,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    library.get.mockResolvedValue({ id: 'ug1' });
    prisma.tag.findMany.mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue([]);
    igdb.getGames.mockResolvedValue([igdbGame]);
    igdb.findSteamAppIds.mockResolvedValue(new Map());
    igdb.getTimesToBeat.mockResolvedValue([
      {
        igdbId: 7,
        mainMinutes: 660,
        extraMinutes: null,
        completeMinutes: null,
      },
    ]);
    prisma.ownership.aggregate.mockResolvedValue({
      _sum: { playtimeMin: 600 },
      _max: { lastPlayedAt: null },
    });
  });

  describe('search', () => {
    it('marks the results already in the library', async () => {
      igdb.searchPcGames.mockResolvedValue([
        { igdbId: 1, title: 'A', releaseYear: 2020, coverUrl: null },
        { igdbId: 2, title: 'B', releaseYear: null, coverUrl: null },
        { igdbId: 3, title: 'C', releaseYear: null, coverUrl: null },
      ]);
      prisma.userGame.findMany.mockResolvedValue([
        { owned: true, game: { igdbId: 1 } },
        { owned: false, game: { igdbId: 2 } },
      ]);

      const results = await service.search('u1', 'hades');
      expect(results.map((result) => result.inLibrary)).toEqual([
        'owned',
        'wishlist',
        null,
      ]);
    });

    it('answers 502 when IGDB fails', async () => {
      igdb.searchPcGames.mockRejectedValue(new Error('timeout'));
      await expect(service.search('u1', 'hades')).rejects.toMatchObject({
        status: 502,
      });
    });
  });

  describe('the catalog game', () => {
    beforeEach(() => {
      prisma.userGame.findUnique.mockResolvedValue(null);
      prisma.userGame.create.mockResolvedValue({ id: 'ug1' });
    });

    it('reuses a game already in the catalog, without asking IGDB', async () => {
      prisma.game.findUnique.mockResolvedValueOnce({
        id: 'g1',
        gameType: 'COMPLETABLE',
      });
      await service.add('u1', { origin: 'wishlist', igdbId: 7 });
      expect(igdb.getGames).not.toHaveBeenCalled();
      expect(prisma.game.create).not.toHaveBeenCalled();
    });

    it('reuses the game Steam already brought, found by its appid', async () => {
      igdb.findSteamAppIds.mockResolvedValue(new Map([[7, 546560]]));
      prisma.game.findUnique
        .mockResolvedValueOnce(null) // by IGDB id
        .mockResolvedValueOnce({
          id: 'g-steam',
          gameType: 'COMPLETABLE',
          igdbId: null,
        });
      await service.add('u1', { origin: 'wishlist', igdbId: 7 });
      expect(prisma.game.create).not.toHaveBeenCalled();
      // It gets its IGDB id now, so the search finds it at once.
      expect(prisma.game.update).toHaveBeenCalledWith({
        where: { id: 'g-steam' },
        data: { igdbId: 7 },
      });
      expect(prisma.userGame.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gameId: 'g-steam' }),
        }),
      );
    });

    it('creates it from IGDB, with its Steam appid, type and tags', async () => {
      igdb.findSteamAppIds.mockResolvedValue(new Map([[7, 546560]]));
      prisma.game.findUnique.mockResolvedValue(null);
      prisma.game.create.mockResolvedValue({
        id: 'g1',
        gameType: 'COMPLETABLE',
      });

      await service.add('u1', { origin: 'wishlist', igdbId: 7 });

      expect(prisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Half-Life: Alyx',
            slug: 'half-life-alyx-546560',
            igdbId: 7,
            steamAppId: 546560,
            coverUrl: 'https://images.igdb.com/cover.jpg',
            ttbMainMin: 660,
            gameType: 'COMPLETABLE',
            // The next sync adds the Steam store's data.
            metadataAt: null,
          }),
        }),
      );
      expect(prisma.tag.createMany).toHaveBeenCalled();
    });

    it('gives a game with no Steam page an IGDB slug, already enriched', async () => {
      prisma.game.findUnique.mockResolvedValue(null);
      prisma.game.create.mockResolvedValue({
        id: 'g1',
        gameType: 'COMPLETABLE',
      });
      await service.add('u1', { origin: 'wishlist', igdbId: 7 });
      expect(prisma.game.create.mock.calls[0][0].data).toMatchObject({
        slug: 'half-life-alyx-igdb-7',
        steamAppId: null,
        metadataAt: expect.any(Date),
      });
    });

    it('takes the game another request created a moment ago', async () => {
      prisma.game.findUnique.mockResolvedValue(null);
      prisma.game.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      prisma.game.findUniqueOrThrow.mockResolvedValue({
        id: 'g-other',
        gameType: 'COMPLETABLE',
      });
      await service.add('u1', { origin: 'wishlist', igdbId: 7 });
      expect(prisma.userGame.create.mock.calls[0][0].data.gameId).toBe(
        'g-other',
      );
    });

    it('answers 404 for an IGDB id with no game', async () => {
      prisma.game.findUnique.mockResolvedValue(null);
      igdb.getGames.mockResolvedValue([]);
      await expect(
        service.add('u1', { origin: 'wishlist', igdbId: 7 }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('adding', () => {
    beforeEach(() => {
      prisma.game.findUnique.mockResolvedValue({
        id: 'g1',
        gameType: 'COMPLETABLE',
      });
    });

    it('adds a wished-for game, kept by the Steam wishlist sync', async () => {
      prisma.userGame.findUnique.mockResolvedValue(null);
      prisma.userGame.create.mockResolvedValue({ id: 'ug1' });
      await service.add('u1', { origin: 'wishlist', igdbId: 7 });
      expect(prisma.userGame.create.mock.calls[0][0].data).toMatchObject({
        owned: false,
        status: 'WISHLIST',
        addedManually: true,
      });
    });

    it('refuses to wish for a game already owned', async () => {
      prisma.userGame.findUnique.mockResolvedValue({ id: 'ug1', owned: true });
      await expect(
        service.add('u1', { origin: 'wishlist', igdbId: 7 }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('adds an owned game with its source, playtime and status', async () => {
      prisma.userGame.findUnique.mockResolvedValue(null);
      prisma.userGame.create.mockResolvedValue({ id: 'ug1' });
      prisma.source.findFirst.mockResolvedValue(null);
      prisma.source.create.mockResolvedValue({ id: 's1' });

      await service.add('u1', {
        origin: 'external',
        igdbId: 7,
        sourceName: 'Jack Sparrow',
        playtimeMinutes: 600,
        status: 'COMPLETED',
      });

      expect(prisma.source.create.mock.calls[0][0].data).toMatchObject({
        platform: 'EXTERNAL',
        displayName: 'Jack Sparrow',
      });
      expect(prisma.ownership.upsert.mock.calls[0][0].create).toMatchObject({
        sourceId: 's1',
        externalAppId: '7',
        playtimeMin: 600,
      });
      expect(prisma.userGame.update.mock.calls[0][0].data).toMatchObject({
        owned: true,
        playtimeMin: 600,
        status: 'COMPLETED',
        statusSource: 'MANUAL',
        completedAt: expect.any(Date),
      });
    });

    it('reuses an external source with the same name, in any case', async () => {
      prisma.userGame.findUnique.mockResolvedValue(null);
      prisma.userGame.create.mockResolvedValue({ id: 'ug1' });
      prisma.source.findFirst.mockResolvedValue({ id: 's-jack' });
      await service.add('u1', {
        origin: 'external',
        igdbId: 7,
        sourceName: 'jack sparrow',
      });
      expect(prisma.source.create).not.toHaveBeenCalled();
      expect(
        prisma.source.findFirst.mock.calls[0][0].where.displayName,
      ).toEqual({ equals: 'jack sparrow', mode: 'insensitive' });
    });

    it('turns a wished-for game into an owned one, with an automatic status', async () => {
      prisma.userGame.findUnique.mockResolvedValue({
        id: 'ug1',
        owned: false,
        status: 'WISHLIST',
        statusSource: 'AUTO',
        completedAt: null,
        typeOverride: null,
      });
      prisma.source.findFirst.mockResolvedValue({ id: 's1' });
      await service.add('u1', {
        origin: 'external',
        igdbId: 7,
        sourceName: 'Epic',
      });
      expect(prisma.userGame.create).not.toHaveBeenCalled();
      // 600 min, no last session: played, so "on hold".
      expect(prisma.userGame.update.mock.calls[0][0].data).toMatchObject({
        owned: true,
        status: 'ON_HOLD',
        statusSource: 'AUTO',
      });
    });

    it("keeps the player's status when the game was theirs already", async () => {
      prisma.userGame.findUnique.mockResolvedValue({
        id: 'ug1',
        owned: true,
        status: 'ABANDONED',
        statusSource: 'MANUAL',
        completedAt: null,
        typeOverride: null,
      });
      prisma.source.findFirst.mockResolvedValue({ id: 's1' });
      await service.add('u1', {
        origin: 'external',
        igdbId: 7,
        sourceName: 'Epic',
      });
      expect(prisma.userGame.update.mock.calls[0][0].data).not.toHaveProperty(
        'status',
      );
    });
  });
});
