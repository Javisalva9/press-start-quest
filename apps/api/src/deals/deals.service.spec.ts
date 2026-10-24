import { Prisma } from '../generated/prisma/client.js';
import { DealsService } from './deals.service.js';

const money = (value: number) => new Prisma.Decimal(value);

const entry = (
  id: string,
  deal: Record<string, unknown>,
  game: Record<string, unknown> = {},
) => ({
  id,
  gameId: `g-${id}`,
  wishlistPriority: null,
  game: {
    title: id,
    coverUrl: null,
    heroUrl: null,
    rating: 80,
    ratingCount: 1000,
    metacritic: null,
    ...game,
    deal: {
      store: 'GOG',
      price: money(10),
      regularPrice: money(20),
      cutPct: 50,
      currency: 'EUR',
      url: `https://itad.link/${id}/`,
      isHistoricalLow: false,
      lowestPrice: money(5),
      expiresAt: null,
      fetchedAt: new Date('2026-10-24T23:40:00Z'),
      ...deal,
    },
  },
});

describe('DealsService', () => {
  const prisma = {
    userGame: { findMany: vi.fn() },
    curatorPick: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  };
  const service = new DealsService(prisma as never);

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.curatorPick.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
  });

  it('lists only the wishlist games an official store sells', async () => {
    prisma.userGame.findMany.mockResolvedValue([]);
    await expect(service.list('u1')).resolves.toEqual({
      items: [],
      updatedAt: null,
    });
    expect(prisma.userGame.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'u1',
          owned: false,
          status: 'WISHLIST',
          hidden: false,
          game: { deal: { isNot: null } },
        },
      }),
    );
  });

  it('sends prices as numbers and puts what fits you first', async () => {
    prisma.userGame.findMany.mockResolvedValue([
      entry('cheap', { price: money(2), cutPct: 90 }),
      entry('yours', { cutPct: 40, isHistoricalLow: true }),
    ]);
    prisma.$queryRaw.mockResolvedValue([
      { gameId: 'g-yours', raw: 3, topTag: 'Metroidvania', topKind: 'GENRE' },
      { gameId: 'g-cheap', raw: 0, topTag: null, topKind: null },
    ]);
    prisma.curatorPick.findMany.mockResolvedValue([
      { gameId: 'g-yours', curator: { name: 'AlexElCapso', color: '#F59E0B' } },
    ]);

    const { items, updatedAt } = await service.list('u1');

    expect(items.map((item) => item.id)).toEqual(['yours', 'cheap']);
    expect(items[0]).toMatchObject({
      price: 10,
      regularPrice: 20,
      lowestPrice: 5,
      fit: 1,
      topTag: { name: 'Metroidvania', kind: 'GENRE' },
      recommendedBy: [{ name: 'AlexElCapso', color: '#F59E0B' }],
    });
    expect(items[1]).toMatchObject({ price: 2, fit: 0, topTag: null });
    expect(updatedAt).toBe('2026-10-24T23:40:00.000Z');
  });
});
