import { CuratorSeeder } from './curator-seeder.js';
import type { CuratorFile } from './curator-file.js';

const file: CuratorFile = {
  curator: { name: 'AlexElCapso', kind: 'CREATOR', color: '#F59E0B' },
  games: [
    { igdbId: 1, title: 'A', year: 2020, listedAs: ['A'] },
    { igdbId: 2, title: 'B', year: 2021, listedAs: ['B'] },
  ],
};

describe('CuratorSeeder', () => {
  const prisma = {
    curator: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    curatorPick: { createMany: vi.fn(), deleteMany: vi.fn() },
    userCurator: { findMany: vi.fn() },
  };
  const catalog = { ensure: vi.fn() };
  const curators = { addPicksToWishlist: vi.fn() };
  const seeder = new CuratorSeeder(
    prisma as never,
    catalog as never,
    curators as never,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    catalog.ensure.mockResolvedValue(
      new Map([
        [1, { id: 'g1', gameType: 'COMPLETABLE' }],
        [2, { id: 'g2', gameType: 'SANDBOX' }],
      ]),
    );
    prisma.curatorPick.createMany.mockResolvedValue({ count: 0 });
    prisma.curatorPick.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('creates the curator, its games and its picks the first time', async () => {
    prisma.curator.findFirst.mockResolvedValue(null);
    prisma.curator.create.mockResolvedValue({ id: 'c1', color: '#F59E0B' });
    prisma.curatorPick.createMany.mockResolvedValue({ count: 2 });
    prisma.userCurator.findMany.mockResolvedValue([]);

    await seeder.seedAll([file]);

    expect(prisma.curator.create.mock.calls[0][0].data).toEqual({
      name: 'AlexElCapso',
      kind: 'CREATOR',
      color: '#F59E0B',
    });
    expect(catalog.ensure).toHaveBeenCalledWith([1, 2]);
    expect(prisma.curatorPick.createMany.mock.calls[0][0]).toEqual({
      data: [
        { curatorId: 'c1', gameId: 'g1' },
        { curatorId: 'c1', gameId: 'g2' },
      ],
      skipDuplicates: true,
    });
  });

  it('drops the picks no longer in the list', async () => {
    prisma.curator.findFirst.mockResolvedValue({ id: 'c1', color: '#F59E0B' });
    await seeder.seedAll([file]);
    expect(prisma.curatorPick.deleteMany).toHaveBeenCalledWith({
      where: { curatorId: 'c1', gameId: { notIn: ['g1', 'g2'] } },
    });
  });

  it("brings new picks to its followers' Lo quiero", async () => {
    prisma.curator.findFirst.mockResolvedValue({ id: 'c1', color: '#F59E0B' });
    prisma.curatorPick.createMany.mockResolvedValue({ count: 1 });
    prisma.userCurator.findMany.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
    ]);
    await seeder.seedAll([file]);
    expect(curators.addPicksToWishlist.mock.calls).toEqual([
      ['u1', 'c1'],
      ['u2', 'c1'],
    ]);
  });

  it('updates the color when the file changes it', async () => {
    prisma.curator.findFirst.mockResolvedValue({ id: 'c1', color: '#000000' });
    await seeder.seedAll([file]);
    expect(prisma.curator.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { color: '#F59E0B' },
    });
  });
});
