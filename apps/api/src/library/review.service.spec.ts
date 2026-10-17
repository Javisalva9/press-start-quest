import { Test } from '@nestjs/testing';
import { FinaleResolver } from '../finale/finale-resolver.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReviewService } from './review.service.js';

const NOW = new Date('2026-10-16T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

/**
 * By default a game that gets a card without any signal: completable, of
 * unknown length, played for 10 h and not being played now.
 */
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'ug1',
  status: 'ON_HOLD',
  playtimeMin: 600,
  lastPlayedAt: daysAgo(5),
  achievementsUnlocked: 3,
  achievementsTotal: 10,
  completionSignal: null,
  completionConfidence: null,
  reviewedAt: null,
  reviewedSignal: null,
  typeOverride: null,
  game: {
    title: 'Game',
    coverUrl: null,
    heroUrl: null,
    ttbMainMin: null,
    gameType: 'COMPLETABLE',
  },
  achievements: [],
  ...overrides,
});

describe('ReviewService', () => {
  const prisma = {
    userGame: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
  // Every achievement it's asked about is a finale, unless a test says.
  const finales = {
    finales: vi.fn((_userId: string, ids: string[]) =>
      Promise.resolve(new Set(ids)),
    ),
  };
  let service: ReviewService;
  const reviewed = new Date('2026-10-01T00:00:00Z');

  beforeEach(async () => {
    vi.resetAllMocks();
    finales.finales.mockImplementation((_userId: string, ids: string[]) =>
      Promise.resolve(new Set(ids)),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: PrismaService, useValue: prisma },
        { provide: FinaleResolver, useValue: finales },
      ],
    }).compile();
    service = moduleRef.get(ReviewService);
  });

  describe('queue', () => {
    it('asks only about games whose status the player has not set', async () => {
      prisma.userGame.findMany.mockResolvedValue([]);
      await service.queue('u1', 20, NOW);
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

    it('asks about games played for an hour, or with a signal', async () => {
      prisma.userGame.findMany.mockResolvedValue([]);
      await service.queue('u1', 20, NOW);
      const { where } = prisma.userGame.findMany.mock.calls[0][0];
      expect(where.AND).toContainEqual({
        OR: [{ completionSignal: { not: null } }, { playtimeMin: { gte: 60 } }],
      });
    });

    it('asks without a signal only about completable games of unknown length', async () => {
      const game = (gameType: string, ttbMainMin: number | null) => ({
        title: 'Game',
        coverUrl: null,
        heroUrl: null,
        ttbMainMin,
        gameType,
      });
      prisma.userGame.findMany.mockResolvedValue([
        row({ id: 'unknown-length' }),
        // Known length under 80 %: no signal, no card (Hades at 66 %).
        row({ id: 'known-length', game: game('COMPLETABLE', 2321) }),
        // Under 5 hours.
        row({ id: 'short', playtimeMin: 299 }),
        // Being played now: obviously not finished.
        row({ id: 'playing', status: 'PLAYING' }),
        // A sandbox is finished by its goal, not its hours.
        row({ id: 'sandbox', game: game('SANDBOX', null) }),
        row({ id: 'unknown-type', game: game('UNKNOWN', null) }),
        // The player's type wins: they said it's completable.
        row({
          id: 'override',
          typeOverride: 'COMPLETABLE',
          game: game('SANDBOX', null),
        }),
        // Any signal is enough, whatever the rest.
        row({
          id: 'signal',
          status: 'PLAYING',
          playtimeMin: 60,
          completionSignal: 'FINALE_ACHIEVEMENT',
          completionConfidence: 0.9,
          game: game('SANDBOX', 2000),
        }),
      ]);

      const { items } = await service.queue('u1', 20, NOW);
      expect(
        items
          .filter((card) => card.question === 'finished')
          .map((card) => card.id)
          .sort(),
      ).toEqual(['override', 'signal', 'unknown-length']);
    });

    it('puts the most likely finished first, then the most played', async () => {
      prisma.userGame.findMany.mockResolvedValue([
        row({ id: 'played-a-lot', playtimeMin: 3000 }),
        row({
          id: 'playtime',
          completionSignal: 'PLAYTIME',
          completionConfidence: 0.6,
        }),
        row({ id: 'played-a-bit', playtimeMin: 400 }),
        row({
          id: 'finale',
          completionSignal: 'FINALE_ACHIEVEMENT',
          completionConfidence: 0.9,
        }),
      ]);

      const { items, total } = await service.queue('u1', 20, NOW);
      expect(items.map((card) => card.id)).toEqual([
        'finale',
        'playtime',
        'played-a-lot',
        'played-a-bit',
      ]);
      expect(total).toBe(4);
    });

    it('brings a turned-down card back only with a stronger signal', async () => {
      prisma.userGame.findMany.mockResolvedValue([
        // Said no to playtime, still playtime: stays out.
        row({
          id: 'same',
          completionSignal: 'PLAYTIME',
          reviewedAt: reviewed,
          reviewedSignal: 'PLAYTIME',
        }),
        // Said no to playtime, now has the finale achievement: back.
        row({
          id: 'stronger',
          completionSignal: 'FINALE_ACHIEVEMENT',
          reviewedAt: reviewed,
          reviewedSignal: 'PLAYTIME',
        }),
        // Said no with no signal at all, now has one: back.
        row({
          id: 'first-signal',
          completionSignal: 'PLAYTIME',
          reviewedAt: reviewed,
          reviewedSignal: null,
        }),
        // Said no with no signal, still none: stays out.
        row({ id: 'nothing-new', reviewedAt: reviewed, reviewedSignal: null }),
      ]);

      const { items } = await service.queue('u1', 20, NOW);
      expect(items.map((card) => card.id).sort()).toEqual([
        'first-signal',
        'stronger',
      ]);
    });

    it('asks "did you drop it?" after 3 months on hold, after the rest', async () => {
      prisma.userGame.findMany.mockResolvedValue([
        // Paused 4 months, answered "no" before its last session: asks.
        row({
          id: 'paused-long',
          status: 'ON_HOLD',
          lastPlayedAt: daysAgo(120),
          reviewedAt: daysAgo(200),
        }),
        // Paused 2 months: not yet.
        row({
          id: 'paused-short',
          status: 'ON_HOLD',
          lastPlayedAt: daysAgo(60),
          reviewedAt: daysAgo(200),
        }),
        // Answered after its last session: already had the chance.
        row({
          id: 'answered',
          status: 'ON_HOLD',
          lastPlayedAt: daysAgo(120),
          reviewedAt: daysAgo(10),
        }),
        // No date and answered: final.
        row({
          id: 'no-date',
          status: 'ON_HOLD',
          lastPlayedAt: null,
          reviewedAt: daysAgo(10),
        }),
        // Never reviewed: the initial "did you finish it?" comes first.
        row({ id: 'triage', status: 'ON_HOLD', lastPlayedAt: daysAgo(120) }),
      ]);

      const { items } = await service.queue('u1', 20, NOW);
      expect(items.map((card) => [card.id, card.question])).toEqual([
        ['triage', 'finished'],
        ['paused-long', 'abandoned'],
      ]);
    });

    it('returns a page, with the total waiting', async () => {
      prisma.userGame.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => row({ id: `ug${i}` })),
      );
      const { items, total } = await service.queue('u1', 2, NOW);
      expect(items).toHaveLength(2);
      expect(total).toBe(5);
    });

    it('shows the finale achievement behind the signal', async () => {
      prisma.userGame.findMany.mockResolvedValue([
        row({
          completionSignal: 'FINALE_ACHIEVEMENT',
          completionConfidence: 0.9,
          game: {
            title: 'Moonlighter',
            coverUrl: null,
            heroUrl: null,
            ttbMainMin: 700,
            gameType: 'COMPLETABLE',
          },
          achievements: [
            {
              achievementId: 'a1',
              achievement: {
                name: 'Careful Merchant',
                description: 'Complete the game under 40 deaths',
              },
            },
          ],
        }),
      ]);
      const { items } = await service.queue('u1', 20, NOW);
      expect(items[0]).toMatchObject({
        signal: 'FINALE_ACHIEVEMENT',
        confidence: 0.9,
        question: 'finished',
        finaleAchievement: { name: 'Careful Merchant' },
        achievements: { unlocked: 3, total: 10 },
        mainStoryMinutes: 700,
      });
    });
  });

  describe('answer', () => {
    beforeEach(() => {
      prisma.userGame.findFirst.mockResolvedValue({
        status: 'BACKLOG',
        completionSignal: 'PLAYTIME',
      });
    });

    it('marks it as completed by the player, with the date', async () => {
      await service.answer('u1', 'ug1', { answer: 'finished' });
      expect(prisma.userGame.update).toHaveBeenCalledWith({
        where: { id: 'ug1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          statusSource: 'MANUAL',
          completedAt: expect.any(Date),
          reviewedSignal: 'PLAYTIME',
        }),
      });
    });

    it.each([
      ['abandoned', 'ABANDONED'],
      ['wontPlay', 'DISCARDED'],
    ] as const)('saves %s as the status %s', async (answer, status) => {
      await service.answer('u1', 'ug1', { answer });
      expect(prisma.userGame.update).toHaveBeenCalledWith({
        where: { id: 'ug1' },
        data: expect.objectContaining({
          status,
          statusSource: 'MANUAL',
          completedAt: null,
        }),
      });
    });

    it('keeps the status automatic on "not finished", noting the signal', async () => {
      await service.answer('u1', 'ug1', { answer: 'notFinished' });
      const { data } = prisma.userGame.update.mock.calls[0][0];
      expect(data).toMatchObject({
        statusSource: 'AUTO',
        reviewedAt: expect.any(Date),
        reviewedSignal: 'PLAYTIME',
      });
      // A "playing" set by the app is left as it is.
      expect(data).not.toHaveProperty('status');
    });

    it('undoes an earlier "finished" with "not finished"', async () => {
      prisma.userGame.findFirst.mockResolvedValue({
        status: 'COMPLETED',
        completionSignal: null,
      });
      await service.answer('u1', 'ug1', { answer: 'notFinished' });
      expect(prisma.userGame.update.mock.calls[0][0].data).toMatchObject({
        status: 'BACKLOG',
        statusSource: 'AUTO',
        completedAt: null,
      });
    });

    it("answers 404 for another user's game", async () => {
      prisma.userGame.findFirst.mockResolvedValue(null);
      await expect(
        service.answer('u1', 'nope', { answer: 'finished' }),
      ).rejects.toMatchObject({ status: 404 });
      expect(prisma.userGame.update).not.toHaveBeenCalled();
    });
  });
});
