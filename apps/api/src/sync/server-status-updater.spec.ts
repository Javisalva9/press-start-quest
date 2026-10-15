import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { ServerStatusUpdater } from './server-status-updater.js';

vi.mock('../catalog/server-status.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../catalog/server-status.js')>()),
  loadServerStatusSeed: () => [
    {
      steamAppId: 10,
      title: 'Closing Game',
      closesOn: '2026-02-25',
      after: 'CLOSED',
      note: 'Online only.',
      source: 'https://example.com/news',
    },
  ],
}));

describe('ServerStatusUpdater', () => {
  const prisma = {
    game: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  };
  let updater: ServerStatusUpdater;
  const closedAt = new Date('2026-02-25T00:00:00Z');

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.game.update.mockImplementation((args) => args);
    prisma.$transaction.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ServerStatusUpdater,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    updater = moduleRef.get(ServerStatusUpdater);
  });

  it('only asks for the listed games of the user', async () => {
    prisma.game.findMany.mockResolvedValue([]);

    await updater.update('u1');

    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          steamAppId: { in: [10] },
          userGames: { some: { userId: 'u1' } },
        }),
      }),
    );
  });

  it('marks a listed game with its status and closing day', async () => {
    prisma.game.findMany.mockResolvedValue([
      {
        id: 'g1',
        title: 'Closing Game',
        steamAppId: 10,
        serverStatus: 'UNKNOWN',
        serverClosedAt: null,
      },
    ]);

    await expect(
      updater.update('u1', new Date('2026-01-01T00:00:00Z')),
    ).resolves.toBe(1);

    expect(prisma.$transaction).toHaveBeenCalledWith([
      {
        where: { id: 'g1' },
        data: { serverStatus: 'ANNOUNCED', serverClosedAt: closedAt },
      },
    ]);
  });

  it('does not write when the status is already right', async () => {
    prisma.game.findMany.mockResolvedValue([
      {
        id: 'g1',
        title: 'Closing Game',
        steamAppId: 10,
        serverStatus: 'CLOSED',
        serverClosedAt: closedAt,
      },
    ]);

    await expect(
      updater.update('u1', new Date('2026-10-15T00:00:00Z')),
    ).resolves.toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
