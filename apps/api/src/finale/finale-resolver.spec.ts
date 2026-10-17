import { FinaleResolver } from './finale-resolver.js';

describe('FinaleResolver', () => {
  const prisma = {
    achievement: { findMany: vi.fn() },
    achievementFinaleVote: { findMany: vi.fn(), groupBy: vi.fn() },
  };
  const resolver = new FinaleResolver(prisma as never);

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.achievement.findMany.mockResolvedValue([
      { id: 'rule', finaleByRule: true },
      { id: 'mine', finaleByRule: false },
      { id: 'crowd', finaleByRule: false },
      { id: 'nothing', finaleByRule: false },
    ]);
    prisma.achievementFinaleVote.findMany.mockResolvedValue([
      { achievementId: 'mine', isFinale: true },
    ]);
    prisma.achievementFinaleVote.groupBy.mockResolvedValue([
      { achievementId: 'mine', isFinale: true, _count: { _all: 1 } },
      { achievementId: 'crowd', isFinale: true, _count: { _all: 4 } },
      { achievementId: 'crowd', isFinale: false, _count: { _all: 1 } },
    ]);
  });

  it('mixes the rules, your vote and everyone else', async () => {
    const resolved = await resolver.resolve('u1', [
      'rule',
      'mine',
      'crowd',
      'nothing',
    ]);
    expect(resolved.get('rule')).toMatchObject({
      finale: true,
      source: 'RULE',
    });
    expect(resolved.get('mine')).toMatchObject({
      finale: true,
      source: 'VOTE',
      yourVote: true,
    });
    // 4 of 5 votes: 80 % agree.
    expect(resolved.get('crowd')).toMatchObject({
      finale: true,
      source: 'CONSENSUS',
    });
    expect(resolved.get('nothing')).toMatchObject({ finale: false });
  });

  it('gives the finale ids only', async () => {
    await expect(
      resolver.finales('u1', ['rule', 'mine', 'crowd', 'nothing']),
    ).resolves.toEqual(new Set(['rule', 'mine', 'crowd']));
  });

  it('asks nothing for no achievements', async () => {
    await expect(resolver.resolve('u1', [])).resolves.toEqual(new Map());
    expect(prisma.achievement.findMany).not.toHaveBeenCalled();
  });
});
