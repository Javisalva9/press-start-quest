import { readFileSync } from 'node:fs';
import { detectCompletion, type CompletionInput } from './completion.js';

interface Fixture extends CompletionInput {
  title: string;
  /** What the player said: the answer the detector is measured against. */
  finished: boolean;
  expected: string | null;
  note?: string;
}

/** The played completable and sandbox games of a real library. */
const library = JSON.parse(
  readFileSync(new URL('./completion.fixtures.json', import.meta.url), 'utf8'),
) as Fixture[];

const base: CompletionInput = {
  gameType: 'COMPLETABLE',
  playtimeMin: 0,
  ttbMainMin: null,
  achievementsUnlocked: null,
  achievementsTotal: null,
  finaleUnlocked: false,
};

describe('detectCompletion', () => {
  it.each(library.map((game) => [game.title, game] as const))(
    '%s',
    (_title, game) => {
      expect(detectCompletion(game)?.signal ?? null).toBe(game.expected);
    },
  );

  it('finds 7 of the 8 finished games of the sample, with 1 false alarm', () => {
    const flagged = library.filter((game) => detectCompletion(game));
    expect(flagged.filter((game) => game.finished)).toHaveLength(7);
    expect(flagged.filter((game) => !game.finished)).toHaveLength(1);
  });

  it('prefers every achievement over the rest, with high confidence', () => {
    expect(
      detectCompletion({
        ...base,
        achievementsUnlocked: 12,
        achievementsTotal: 12,
        finaleUnlocked: true,
      }),
    ).toEqual({ signal: 'ALL_ACHIEVEMENTS', confidence: 0.9 });
  });

  it('uses playtime only for completable games, with medium confidence', () => {
    const played = { ...base, playtimeMin: 800, ttbMainMin: 1000 };
    expect(detectCompletion(played)).toEqual({
      signal: 'PLAYTIME',
      confidence: 0.6,
    });
    expect(detectCompletion({ ...played, gameType: 'SANDBOX' })).toBeNull();
    expect(detectCompletion({ ...played, playtimeMin: 799 })).toBeNull();
  });

  it('accepts a finale achievement in a sandbox: its recognized ending', () => {
    expect(
      detectCompletion({ ...base, gameType: 'SANDBOX', finaleUnlocked: true })
        ?.signal,
    ).toBe('FINALE_ACHIEVEMENT');
  });

  it('never flags an endless game', () => {
    expect(
      detectCompletion({
        ...base,
        gameType: 'ENDLESS',
        achievementsUnlocked: 5,
        achievementsTotal: 5,
      }),
    ).toBeNull();
  });

  it('does not take 0 of 0 achievements as all of them', () => {
    expect(
      detectCompletion({
        ...base,
        achievementsUnlocked: 0,
        achievementsTotal: 0,
      }),
    ).toBeNull();
  });
});
