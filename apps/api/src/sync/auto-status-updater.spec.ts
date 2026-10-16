import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { AutoStatusUpdater } from './auto-status-updater.js';

const now = new Date('2026-10-16T12:00:00Z');
const entry = (overrides: Record<string, unknown>) => ({
  id: 'ug1',
  status: 'BACKLOG',
  playtimeMin: 600,
  lastPlayedAt: new Date('2026-10-10T00:00:00Z'),
  typeOverride: null,
  game: { gameType: 'COMPLETABLE' },
  ...overrides,
});

describe('AutoStatusUpdater', () => {
  const prisma = {
    userGame: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  let updater: AutoStatusUpdater;

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.userGame.updateMany.mockImplementation((args) => args);
    prisma.$transaction.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AutoStatusUpdater,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    updater = moduleRef.get(AutoStatusUpdater);
  });

  it('only looks at owned games whose status the player has not set', async () => {
    prisma.userGame.findMany.mockResolvedValue([]);
    await updater.update('u1', now);
    expect(prisma.userGame.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'u1',
          owned: true,
          statusSource: 'AUTO',
        }),
      }),
    );
  });

  it('writes only the statuses that changed, one update per status', async () => {
    prisma.userGame.findMany.mockResolvedValue([
      entry({ id: 'recent' }),
      entry({ id: 'old', lastPlayedAt: new Date('2026-01-01T00:00:00Z') }),
      entry({ id: 'already', status: 'PLAYING' }),
    ]);

    await expect(updater.update('u1', now)).resolves.toBe(2);
    expect(prisma.$transaction).toHaveBeenCalledWith([
      { where: { id: { in: ['recent'] } }, data: { status: 'PLAYING' } },
      { where: { id: { in: ['old'] } }, data: { status: 'ON_HOLD' } },
    ]);
  });

  it("uses the player's type over the catalog's", async () => {
    prisma.userGame.findMany.mockResolvedValue([
      entry({
        lastPlayedAt: new Date('2026-01-01T00:00:00Z'),
        typeOverride: 'ENDLESS',
      }),
    ]);
    await expect(updater.update('u1', now)).resolves.toBe(0);
  });
});
