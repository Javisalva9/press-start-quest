import { readFileSync } from 'node:fs';
import { isFinaleAchievement } from './finale-achievement.js';

interface Case {
  game: string;
  name: string;
  description: string;
  finale: boolean;
}

/**
 * Real achievements: every finale the rules find in a 24-game library, and
 * up to 4 per game that look like one but aren't ("Finish the level…").
 */
const cases = JSON.parse(
  readFileSync(
    new URL('./finale-achievement.fixtures.json', import.meta.url),
    'utf8',
  ),
) as Case[];

describe('isFinaleAchievement', () => {
  it.each(cases.map((c) => [`${c.game}: ${c.name}`, c] as const))(
    '%s',
    (_label, c) => {
      expect(isFinaleAchievement(c)).toBe(c.finale);
    },
  );

  it('accepts harder variants: they still mean the game was finished', () => {
    expect(
      isFinaleAchievement({
        name: 'Speedrun 2',
        description: 'Complete the game in under 5 hours',
      }),
    ).toBe(true);
  });

  it('rejects levels, tutorials and openings', () => {
    for (const description of [
      'Finish the level Bridge',
      'Complete the Tutorial',
      "Complete the story's opening sequence in any mode.",
      'Win a campaign battle in less than 10 second with a single tank',
      'Won a game of Rock/Paper/Scissors.',
    ]) {
      expect(isFinaleAchievement({ name: 'X', description })).toBe(false);
    }
  });

  it('reads the name when the achievement is hidden', () => {
    expect(
      isFinaleAchievement({
        name: 'The Final Battle of the First Hero',
        description: '',
      }),
    ).toBe(true);
  });
});
