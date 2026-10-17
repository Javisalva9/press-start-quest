import { Test } from '@nestjs/testing';
import { FinaleResolver } from '../finale/finale-resolver.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CompletionDetector } from './completion-detector.js';

const entry = (overrides: Record<string, unknown>) => ({
  id: 'ug1',
  playtimeMin: 0,
  achievementsUnlocked: 0,
  achievementsTotal: 10,
  typeOverride: null,
  completionSignal: null,
  completionConfidence: null,
  game: { gameType: 'COMPLETABLE', ttbMainMin: 1000 },
  achievements: [],
  ...overrides,
});

describe('CompletionDetector', () => {
  const prisma = {
    userGame: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  // The unlocked achievements given are finales (rules and votes are
  // FinaleResolver's job, tested apart).
  const finales = {
    finales: vi.fn((_userId: string, ids: string[]) =>
      Promise.resolve(new Set(ids)),
    ),
  };
  let detector: CompletionDetector;

  beforeEach(async () => {
    vi.resetAllMocks();
    finales.finales.mockImplementation((_userId: string, ids: string[]) =>
      Promise.resolve(new Set(ids)),
    );
    prisma.userGame.updateMany.mockImplementation((args) => args);
    prisma.$transaction.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        CompletionDetector,
        { provide: PrismaService, useValue: prisma },
        { provide: FinaleResolver, useValue: finales },
      ],
    }).compile();
    detector = moduleRef.get(CompletionDetector);
  });

  it('only looks at games whose status the player has not set', async () => {
    prisma.userGame.findMany.mockResolvedValue([]);
    await detector.update('u1');
    expect(prisma.userGame.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1', statusSource: 'AUTO' }),
      }),
    );
  });

  it('saves the signal and its confidence, grouped by result', async () => {
    prisma.userGame.findMany.mockResolvedValue([
      entry({ id: 'ug1', achievements: [{ achievementId: 'a1' }] }),
      entry({ id: 'ug2', achievements: [{ achievementId: 'a2' }] }),
      entry({ id: 'ug3', playtimeMin: 900 }),
      // Already up to date.
      entry({
        id: 'ug4',
        playtimeMin: 850,
        completionSignal: 'PLAYTIME',
        completionConfidence: 0.6,
      }),
    ]);

    await expect(detector.update('u1')).resolves.toBe(3);
    expect(prisma.$transaction).toHaveBeenCalledWith([
      {
        where: { id: { in: ['ug1', 'ug2'] } },
        data: {
          completionSignal: 'FINALE_ACHIEVEMENT',
          completionConfidence: 0.9,
        },
      },
      {
        where: { id: { in: ['ug3'] } },
        data: { completionSignal: 'PLAYTIME', completionConfidence: 0.6 },
      },
    ]);
  });

  it('counts only the unlocked achievements that are finales', async () => {
    finales.finales.mockResolvedValue(new Set());
    prisma.userGame.findMany.mockResolvedValue([
      entry({ achievements: [{ achievementId: 'not-a-finale' }] }),
    ]);
    await expect(detector.update('u1')).resolves.toBe(0);
  });

  it("uses the player's type over the catalog's", async () => {
    prisma.userGame.findMany.mockResolvedValue([
      // Enough playtime, but the player says it's endless.
      entry({ playtimeMin: 2000, typeOverride: 'ENDLESS' }),
    ]);
    await expect(detector.update('u1')).resolves.toBe(0);
  });
});
