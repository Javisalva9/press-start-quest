import { Prisma } from '../generated/prisma/client.js';
import { IgdbCatalog, IgdbUnavailableError } from './igdb-catalog.service.js';

const igdbGame = (igdbId: number, title = `Game ${igdbId}`) => ({
  igdbId,
  title,
  slug: 'x',
  summary: null,
  releaseDate: null,
  rating: 90,
  ratingCount: 100,
  coverUrl: `https://images.igdb.com/${igdbId}.jpg`,
  developer: null,
  genres: ['Adventure'],
  themes: [],
  modes: ['Single player'],
  perspectives: [],
});

describe('IgdbCatalog', () => {
  const prisma = {
    game: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    tag: { createMany: vi.fn(), findMany: vi.fn() },
    gameTag: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const igdb = {
    getGames: vi.fn(),
    findSteamAppIds: vi.fn(),
    getTimesToBeat: vi.fn(),
  };
  const catalog = new IgdbCatalog(prisma as never, igdb as never);

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.game.findMany.mockResolvedValue([]);
    prisma.tag.findMany.mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue([]);
    igdb.getGames.mockImplementation((ids: number[]) =>
      Promise.resolve(ids.map((id) => igdbGame(id))),
    );
    igdb.findSteamAppIds.mockResolvedValue(new Map());
    igdb.getTimesToBeat.mockResolvedValue([]);
    prisma.game.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: `g-${data.igdbId}`, gameType: data.gameType }),
    );
  });

  it('reuses the games already in the catalog, without asking IGDB', async () => {
    prisma.game.findMany.mockResolvedValueOnce([
      { id: 'g1', gameType: 'COMPLETABLE', igdbId: 1 },
    ]);
    const found = await catalog.ensure([1, 1]);
    expect(found.get(1)).toEqual({ id: 'g1', gameType: 'COMPLETABLE' });
    expect(igdb.getGames).not.toHaveBeenCalled();
  });

  it('reuses the game Steam brought, giving it its IGDB id', async () => {
    igdb.findSteamAppIds.mockResolvedValue(new Map([[7, 546560]]));
    prisma.game.findMany
      .mockResolvedValueOnce([]) // by IGDB id
      .mockResolvedValueOnce([
        {
          id: 'g-steam',
          gameType: 'COMPLETABLE',
          igdbId: null,
          steamAppId: 546560,
        },
      ]);
    const found = await catalog.ensure([7]);
    expect(found.get(7)?.id).toBe('g-steam');
    expect(prisma.game.update).toHaveBeenCalledWith({
      where: { id: 'g-steam' },
      data: { igdbId: 7 },
    });
    expect(prisma.game.create).not.toHaveBeenCalled();
  });

  it('creates the missing ones with their Steam appid, type and tags', async () => {
    igdb.findSteamAppIds.mockResolvedValue(new Map([[7, 546560]]));
    igdb.getTimesToBeat.mockResolvedValue([
      {
        igdbId: 7,
        mainMinutes: 660,
        extraMinutes: null,
        completeMinutes: null,
      },
    ]);
    const found = await catalog.ensure([7, 8]);

    expect(found.get(7)?.id).toBe('g-7');
    const [withSteam, withoutSteam] = prisma.game.create.mock.calls.map(
      ([args]) => args.data,
    );
    expect(withSteam).toMatchObject({
      slug: 'game-7-546560',
      steamAppId: 546560,
      ttbMainMin: 660,
      gameType: 'COMPLETABLE',
      // The next sync adds the Steam store's data.
      metadataAt: null,
    });
    expect(withoutSteam).toMatchObject({
      slug: 'game-8-igdb-8',
      steamAppId: null,
      metadataAt: expect.any(Date),
    });
    expect(prisma.tag.createMany).toHaveBeenCalled();
  });

  it('leaves out the ids IGDB does not know', async () => {
    igdb.getGames.mockResolvedValue([igdbGame(7)]);
    const found = await catalog.ensure([7, 999]);
    expect([...found.keys()]).toEqual([7]);
  });

  it('takes the game another request created a moment ago', async () => {
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
    expect((await catalog.ensure([7])).get(7)?.id).toBe('g-other');
  });

  it('asks IGDB in batches of 100', async () => {
    await catalog.ensure(Array.from({ length: 250 }, (_, i) => i + 1));
    expect(igdb.getGames.mock.calls.map(([ids]) => ids.length)).toEqual([
      100, 100, 50,
    ]);
  });

  it('says so when IGDB fails', async () => {
    igdb.getGames.mockRejectedValue(new Error('timeout'));
    await expect(catalog.ensure([7])).rejects.toBeInstanceOf(
      IgdbUnavailableError,
    );
  });
});
