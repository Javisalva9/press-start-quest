import { CuratorsService } from './curators.service.js';

const pick = (owned?: boolean) => ({
  game: { userGames: owned === undefined ? [] : [{ owned }] },
});

describe('CuratorsService', () => {
  const prisma = {
    curator: { findMany: vi.fn(), findFirst: vi.fn() },
    userCurator: { upsert: vi.fn(), deleteMany: vi.fn() },
    curatorPick: { findMany: vi.fn() },
    userGame: { createMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const service = new CuratorsService(prisma as never);

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.curator.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.curator.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'AlexElCapso',
        kind: 'CREATOR',
        color: '#F59E0B',
        followers: [],
        picks: [pick(true), pick(false), pick()],
      },
    ]);
    prisma.userGame.deleteMany.mockImplementation((args) => args);
    prisma.userCurator.deleteMany.mockImplementation((args) => args);
    prisma.$transaction.mockResolvedValue([]);
  });

  it('counts the games and how many the player owns', async () => {
    await expect(service.list('u1')).resolves.toEqual([
      {
        id: 'c1',
        name: 'AlexElCapso',
        kind: 'CREATOR',
        color: '#F59E0B',
        games: 3,
        owned: 1,
        following: false,
      },
    ]);
    // Global creators and the player's own friends only.
    expect(prisma.curator.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ userId: null }, { userId: 'u1' }],
    });
  });

  it('adds to "Lo quiero" only the games with no entry yet', async () => {
    prisma.curatorPick.findMany.mockResolvedValue([
      { gameId: 'g1' },
      { gameId: 'g2' },
    ]);
    prisma.userGame.createMany.mockResolvedValue({ count: 2 });

    await expect(service.addPicksToWishlist('u1', 'c1')).resolves.toBe(2);
    expect(prisma.curatorPick.findMany.mock.calls[0][0].where).toEqual({
      curatorId: 'c1',
      game: { userGames: { none: { userId: 'u1' } } },
    });
    expect(prisma.userGame.createMany.mock.calls[0][0].data[0]).toEqual({
      userId: 'u1',
      gameId: 'g1',
      owned: false,
      status: 'WISHLIST',
      addedByCuratorId: 'c1',
    });
  });

  it('follows and fills "Lo quiero"', async () => {
    prisma.curatorPick.findMany.mockResolvedValue([]);
    await service.follow('u1', 'c1');
    expect(prisma.userCurator.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 'u1', curatorId: 'c1' },
      }),
    );
  });

  it('unfollows removing only what its list added and nobody touched', async () => {
    await service.unfollow('u1', 'c1');
    const [, removeGames] = prisma.$transaction.mock.calls[0][0];
    expect(removeGames.where).toEqual({
      userId: 'u1',
      addedByCuratorId: 'c1',
      owned: false,
      status: 'WISHLIST',
      statusSource: 'AUTO',
      // Removed by hand stays removed, even after following again.
      hidden: false,
    });
  });

  it("answers 404 for someone else's friend or a missing curator", async () => {
    prisma.curator.findFirst.mockResolvedValue(null);
    await expect(service.follow('u1', 'nope')).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.userCurator.upsert).not.toHaveBeenCalled();
  });
});
