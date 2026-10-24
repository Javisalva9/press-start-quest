import { FreeGamesService } from './free-games.service.js';

const NOW = new Date('2026-10-24T14:00:00Z');

describe('FreeGamesService', () => {
  const prisma = {
    freeGame: {
      deleteMany: vi.fn((args: unknown) => ({ deleteMany: args })),
      upsert: vi.fn((args: unknown) => ({ upsert: args })),
      findMany: vi.fn(),
    },
    userGame: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const gamerPower = { freeGames: vi.fn() };
  const service = new FreeGamesService(prisma as never, gamerPower as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces the list with today's giveaways in one transaction", async () => {
    gamerPower.freeGames.mockResolvedValue([
      {
        id: 3200,
        title: 'Hogwarts Legacy',
        worth: '$59.99',
        imageUrl: 'https://x/i.jpg',
        url: 'https://x/open',
        stores: ['Epic Games Store'],
        endsAt: new Date('2026-10-30T23:59:00Z'),
      },
    ]);
    await expect(service.refresh(NOW)).resolves.toEqual({ freeGames: 1 });
    expect(prisma.freeGame.deleteMany).toHaveBeenCalledWith({
      where: { id: { notIn: [3200] } },
    });
    expect(prisma.freeGame.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3200 },
        update: expect.objectContaining({
          title: 'Hogwarts Legacy',
          fetchedAt: NOW,
        }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('says which ones you already have or want, by title', async () => {
    const free = (id: number, title: string) => ({
      id,
      title,
      worth: null,
      imageUrl: 'https://x/i.jpg',
      url: 'https://x/open',
      stores: ['Steam'],
      endsAt: null,
      fetchedAt: new Date('2026-10-23T23:40:00Z'),
    });
    prisma.freeGame.findMany.mockResolvedValue([
      free(1, 'Hogwarts Legacy'),
      free(2, 'Alien: Isolation'),
      free(3, 'Something New'),
    ]);
    prisma.userGame.findMany.mockResolvedValue([
      { owned: true, status: 'BACKLOG', game: { title: 'Hogwarts Legacy™' } },
      { owned: false, status: 'WISHLIST', game: { title: 'Alien Isolation' } },
    ]);

    const { items, updatedAt } = await service.list('u1', NOW);

    expect(
      items.map(({ id, owned, wanted }) => ({ id, owned, wanted })),
    ).toEqual([
      { id: 1, owned: true, wanted: false },
      { id: 2, owned: false, wanted: true },
      { id: 3, owned: false, wanted: false },
    ]);
    expect(updatedAt).toBe('2026-10-23T23:40:00.000Z');
    expect(prisma.freeGame.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ endsAt: null }, { endsAt: { gt: NOW } }] },
      }),
    );
  });
});
