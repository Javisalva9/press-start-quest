import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { GameTypeUpdater } from './game-type-updater.js';

const tag = (kind: string, name: string) => ({ tag: { kind, name } });

describe('GameTypeUpdater', () => {
  const prisma = {
    game: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  let updater: GameTypeUpdater;

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.game.updateMany.mockImplementation((args) => args);
    prisma.$transaction.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameTypeUpdater,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    updater = moduleRef.get(GameTypeUpdater);
  });

  it('saves only the types that changed, one update per type', async () => {
    prisma.game.findMany.mockResolvedValue([
      // Was UNKNOWN, has a story length: completable.
      { id: 'g1', gameType: 'UNKNOWN', ttbMainMin: 600, tags: [] },
      { id: 'g2', gameType: 'UNKNOWN', ttbMainMin: 900, tags: [] },
      // Battle royale: endless.
      {
        id: 'g3',
        gameType: 'UNKNOWN',
        ttbMainMin: 955,
        tags: [tag('MODE', 'Battle Royale')],
      },
      // Already right: not written again.
      { id: 'g4', gameType: 'COMPLETABLE', ttbMainMin: 300, tags: [] },
    ]);

    await expect(updater.update('u1')).resolves.toBe(3);

    expect(prisma.$transaction).toHaveBeenCalledWith([
      {
        where: { id: { in: ['g1', 'g2'] } },
        data: { gameType: 'COMPLETABLE' },
      },
      { where: { id: { in: ['g3'] } }, data: { gameType: 'ENDLESS' } },
    ]);
  });

  it('does not write when nothing changed', async () => {
    prisma.game.findMany.mockResolvedValue([
      { id: 'g1', gameType: 'COMPLETABLE', ttbMainMin: 600, tags: [] },
    ]);

    await expect(updater.update('u1')).resolves.toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
