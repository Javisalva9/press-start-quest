import type { ItadPrice } from '../providers/itad/itad-api.js';
import { PricesService } from './prices.service.js';

const NOW = new Date('2026-10-24T23:40:00Z');

const sold = (
  itadId: string,
  price: number,
  cutPct: number,
  lowest: number | null,
): ItadPrice => ({
  itadId,
  current: {
    shop: 'GOG',
    price,
    regularPrice: 20,
    cutPct,
    currency: 'EUR',
    url: `https://itad.link/${itadId}/`,
    expiresAt: null,
  },
  lowest:
    lowest === null ? null : { price: lowest, at: new Date('2025-06-26') },
});

describe('PricesService', () => {
  const prisma = {
    game: { findMany: vi.fn(), update: vi.fn() },
    deal: {
      upsert: vi.fn((args: unknown) => args),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const itad = {
    enabled: true,
    shops: vi.fn(),
    findBySteamAppIds: vi.fn(),
    prices: vi.fn(),
  };
  const service = new PricesService(prisma as never, itad as never);

  beforeEach(() => {
    vi.clearAllMocks();
    itad.shops.mockResolvedValue([
      { id: 61, title: 'Steam' },
      { id: 35, title: 'GOG' },
      { id: 99, title: 'Some Key Shop' },
    ]);
    itad.findBySteamAppIds.mockResolvedValue(new Map());
    itad.prices.mockResolvedValue([]);
    // The second findMany: ITAD ids already taken by other games.
    prisma.game.findMany.mockResolvedValueOnce([]).mockResolvedValue([]);
  });

  it('prices the games someone wants, only in official stores in Spain', async () => {
    prisma.game.findMany
      .mockReset()
      .mockResolvedValueOnce([{ id: 'g1', steamAppId: 620, itadId: 'uuid-1' }]);
    await service.refresh(NOW);
    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userGames: {
            some: { owned: false, status: 'WISHLIST', hidden: false },
          },
        },
      }),
    );
    expect(itad.shops).toHaveBeenCalledWith('ES');
    // Steam and GOG are in the list; the key shop isn't.
    expect(itad.prices).toHaveBeenCalledWith(['uuid-1'], [61, 35], 'ES');
  });

  it('finds the ITAD id from the Steam appid once, and keeps it', async () => {
    prisma.game.findMany.mockReset();
    prisma.game.findMany
      .mockResolvedValueOnce([
        { id: 'g1', steamAppId: 620, itadId: null },
        { id: 'g2', steamAppId: 400, itadId: null },
        // No appid: left out for now.
        { id: 'g3', steamAppId: null, itadId: null },
      ])
      // uuid-2 already belongs to another game (another edition).
      .mockResolvedValueOnce([{ itadId: 'uuid-2' }]);
    itad.findBySteamAppIds.mockResolvedValue(
      new Map([
        [620, 'uuid-1'],
        [400, 'uuid-2'],
      ]),
    );

    await service.refresh(NOW);

    expect(itad.findBySteamAppIds).toHaveBeenCalledWith([620, 400]);
    expect(prisma.game.update).toHaveBeenCalledTimes(1);
    expect(prisma.game.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { itadId: 'uuid-1' },
    });
    expect(itad.prices).toHaveBeenCalledWith(['uuid-1'], [61, 35], 'ES');
  });

  it('saves one row per game, marking historical lows, and drops the unsold', async () => {
    prisma.game.findMany.mockReset().mockResolvedValueOnce([
      { id: 'g1', steamAppId: 1, itadId: 'uuid-1' },
      { id: 'g2', steamAppId: 2, itadId: 'uuid-2' },
      { id: 'g3', steamAppId: 3, itadId: 'uuid-3' },
      { id: 'g4', steamAppId: 4, itadId: 'uuid-4' },
    ]);
    itad.prices.mockResolvedValue([
      sold('uuid-1', 4.99, 75, 4.99),
      sold('uuid-2', 9.99, 50, 4.99),
      // Full price, the same as its lowest: not a "historical low" deal.
      sold('uuid-3', 20, 0, 20),
      { itadId: 'uuid-4', current: null, lowest: null },
    ]);

    await expect(service.refresh(NOW)).resolves.toEqual({
      wanted: 4,
      onItad: 4,
      priced: 3,
      onSale: 2,
      historicalLows: 1,
      storesMissing: expect.any(Array),
    });
    expect(prisma.deal.upsert).toHaveBeenCalledWith({
      where: { gameId: 'g1' },
      create: expect.objectContaining({ gameId: 'g1', price: 4.99 }),
      update: {
        store: 'GOG',
        price: 4.99,
        regularPrice: 20,
        cutPct: 75,
        currency: 'EUR',
        url: 'https://itad.link/uuid-1/',
        isHistoricalLow: true,
        lowestPrice: 4.99,
        lowestAt: new Date('2025-06-26'),
        expiresAt: null,
        fetchedAt: NOW,
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.deal.deleteMany).toHaveBeenCalledWith({
      where: { gameId: { in: ['g4'] } },
    });
  });

  it("doesn't ask for prices when nobody wants anything", async () => {
    prisma.game.findMany.mockReset().mockResolvedValueOnce([]);
    await service.refresh(NOW);
    expect(itad.prices).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
