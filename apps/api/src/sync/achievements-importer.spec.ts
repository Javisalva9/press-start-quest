import { countAchievements } from './achievements-importer.js';

describe('countAchievements', () => {
  it('counts unlocked and total achievements', () => {
    expect(
      countAchievements([
        { id: 'a', name: 'A', description: '', unlockedAt: new Date() },
        { id: 'b', name: 'B', description: '', unlockedAt: null },
        { id: 'c', name: 'C', description: '', unlockedAt: new Date() },
      ]),
    ).toEqual({ achievementsUnlocked: 2, achievementsTotal: 3 });
  });

  it('saves 0 / 0 for a game without achievements, so it is not asked again', () => {
    expect(countAchievements(null)).toEqual({
      achievementsUnlocked: 0,
      achievementsTotal: 0,
    });
  });
});
