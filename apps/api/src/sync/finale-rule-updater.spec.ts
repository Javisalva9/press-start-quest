import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { FinaleRuleUpdater } from './finale-rule-updater.js';

describe('FinaleRuleUpdater', () => {
  const prisma = {
    achievement: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  let updater: FinaleRuleUpdater;

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.achievement.updateMany.mockImplementation((args) => args);
    prisma.$transaction.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        FinaleRuleUpdater,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    updater = moduleRef.get(FinaleRuleUpdater);
  });

  it('marks and unmarks only what disagrees with the rules', async () => {
    prisma.achievement.findMany.mockResolvedValue([
      // A finale not marked yet.
      {
        id: 'a1',
        name: 'Rescued!',
        description: 'Complete the entire campaign!',
        finaleByRule: false,
      },
      // Marked by an older rule, no longer a finale.
      {
        id: 'a2',
        name: 'Solid Start',
        description: 'Finish the level Machine Room',
        finaleByRule: true,
      },
      // Already right.
      {
        id: 'a3',
        name: 'Loose Ends',
        description: 'Completed the Epilogue.',
        finaleByRule: true,
      },
    ]);

    await expect(updater.update('u1')).resolves.toBe(2);
    expect(prisma.$transaction).toHaveBeenCalledWith([
      { where: { id: { in: ['a1'] } }, data: { finaleByRule: true } },
      { where: { id: { in: ['a2'] } }, data: { finaleByRule: false } },
    ]);
  });

  it('does not write when everything agrees', async () => {
    prisma.achievement.findMany.mockResolvedValue([]);
    await expect(updater.update('u1')).resolves.toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
