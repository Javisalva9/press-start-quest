import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReviewService } from './review.service.js';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'ug1',
  playtimeMin: 600,
  achievementsUnlocked: 3,
  achievementsTotal: 10,
  completionSignal: null,
  completionConfidence: null,
  reviewedAt: null,
  reviewedSignal: null,
  game: { title: 'Game', coverUrl: null, heroUrl: null, ttbMainMin: 700 },
  achievements: [],
  ...overrides,
});

describe('ReviewService', () => {
  const prisma = {
    userGame: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
  let service: ReviewService;
  const reviewed = new Date('2026-10-01T00:00:00Z');

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ReviewService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ReviewService);
  });

  describe('queue', () => {
    it('asks only about games whose status the player has not set', async () => {
      prisma.userGame.findMany.mockResolvedValue([]);
      await service.queue('u1', 20);
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

    it('puts the most likely finished first, then the most played', async () => {
      prisma.userGame.findMany.mockResolvedValue([
        row({ id: 'played-a-lot', playtimeMin: 3000 }),
        row({
          id: 'playtime',
          completionSignal: 'PLAYTIME',
          completionConfidence: 0.6,
        }),
        row({ id: 'played-a-bit', playtimeMin: 30 }),
        row({
          id: 'finale',
          completionSignal: 'FINALE_ACHIEVEMENT',
          completionConfidence: 0.9,
        }),
      ]);

      const { items, total } = await service.queue('u1', 20);
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

      const { items } = await service.queue('u1', 20);
      expect(items.map((card) => card.id).sort()).toEqual([
        'first-signal',
        'stronger',
      ]);
    });

    it('returns a page, with the total waiting', async () => {
      prisma.userGame.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => row({ id: `ug${i}` })),
      );
      const { items, total } = await service.queue('u1', 2);
      expect(items).toHaveLength(2);
      expect(total).toBe(5);
    });

    it('shows the finale achievement behind the signal', async () => {
      prisma.userGame.findMany.mockResolvedValue([
        row({
          completionSignal: 'FINALE_ACHIEVEMENT',
          completionConfidence: 0.9,
          achievements: [
            {
              achievement: {
                name: 'Careful Merchant',
                description: 'Complete the game under 40 deaths',
              },
            },
          ],
        }),
      ]);
      const { items } = await service.queue('u1', 20);
      expect(items[0]).toMatchObject({
        signal: 'FINALE_ACHIEVEMENT',
        confidence: 0.9,
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
