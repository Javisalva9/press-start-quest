import { AchievementsService } from './achievements.service.js';

const achievement = (id: string, unlockedAt: Date | null, name = id) => ({
  id,
  name,
  description: '',
  unlocks: unlockedAt ? [{ unlockedAt }] : [],
});

describe('AchievementsService', () => {
  const prisma = {
    userGame: { findFirst: vi.fn() },
    achievement: { findMany: vi.fn(), findFirst: vi.fn() },
    achievementFinaleVote: { upsert: vi.fn(), deleteMany: vi.fn() },
  };
  const finales = { resolve: vi.fn() };
  const completions = { update: vi.fn() };
  const service = new AchievementsService(
    prisma as never,
    finales as never,
    completions as never,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.userGame.findFirst.mockResolvedValue({ gameId: 'g1' });
    finales.resolve.mockImplementation((_userId: string, ids: string[]) =>
      Promise.resolve(
        new Map(
          ids.map((id) => [
            id,
            {
              finale: id === 'end',
              source: 'RULE',
              byRule: id === 'end',
              yourVote: null,
            },
          ]),
        ),
      ),
    );
  });

  it('lists unlocked first, the latest on top, then the rest by name', async () => {
    prisma.achievement.findMany.mockResolvedValue([
      achievement('zeta', null),
      achievement('old', new Date('2026-01-01T00:00:00Z')),
      achievement('alpha', null),
      achievement('end', new Date('2026-05-01T00:00:00Z')),
    ]);
    const list = await service.list('u1', 'ug1');
    expect(list.map((item) => item.id)).toEqual([
      'end',
      'old',
      'alpha',
      'zeta',
    ]);
    expect(list[0]?.finale).toEqual({
      isFinale: true,
      source: 'RULE',
      byRule: true,
      yourVote: null,
    });
  });

  it('saves a vote and works out the completion signals at once', async () => {
    prisma.achievement.findFirst.mockResolvedValue(achievement('hk', null));
    await service.vote('u1', 'ug1', 'hk', { isFinale: true });
    expect(prisma.achievementFinaleVote.upsert).toHaveBeenCalledWith({
      where: { userId_achievementId: { userId: 'u1', achievementId: 'hk' } },
      create: { userId: 'u1', achievementId: 'hk', isFinale: true },
      update: { isFinale: true },
    });
    expect(completions.update).toHaveBeenCalledWith('u1');
  });

  it('takes a vote back with null', async () => {
    prisma.achievement.findFirst.mockResolvedValue(achievement('hk', null));
    await service.vote('u1', 'ug1', 'hk', { isFinale: null });
    expect(prisma.achievementFinaleVote.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', achievementId: 'hk' },
    });
    expect(prisma.achievementFinaleVote.upsert).not.toHaveBeenCalled();
  });

  it('answers 404 for an achievement of another game', async () => {
    prisma.achievement.findFirst.mockResolvedValue(null);
    await expect(
      service.vote('u1', 'ug1', 'other', { isFinale: true }),
    ).rejects.toMatchObject({ status: 404 });
    expect(completions.update).not.toHaveBeenCalled();
  });

  it("answers 404 for another player's game", async () => {
    prisma.userGame.findFirst.mockResolvedValue(null);
    await expect(service.list('u1', 'ug9')).rejects.toMatchObject({
      status: 404,
    });
  });
});
