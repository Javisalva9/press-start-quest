import { readFileSync } from 'node:fs';
import { classifyGameType, type GameTypeInput } from './game-type.js';

interface Fixture extends GameTypeInput {
  title: string;
  /** What the classifier must answer. */
  expected: string;
  /** For the known misses: what the game really is. */
  actually?: string;
  note?: string;
}

/** A real library: 64 games with their tags as saved by a sync. */
const library = JSON.parse(
  readFileSync(new URL('./game-type.fixtures.json', import.meta.url), 'utf8'),
) as Fixture[];

const base: GameTypeInput = {
  modes: [],
  genres: [],
  themes: [],
  storeCategories: [],
  ttbMainMin: null,
};

describe('classifyGameType', () => {
  it.each(library.map((game) => [game.title, game] as const))(
    'classifies %s',
    (_title, game) => {
      expect(classifyGameType(game).type).toBe(game.expected);
    },
  );

  it('gets right at least 61 of the 64 games of the sample library', () => {
    const right = library.filter(
      (game) =>
        classifyGameType(game).type === (game.actually ?? game.expected),
    );
    expect(right.length).toBeGreaterThanOrEqual(61);
  });

  it('checks the endless rules before the story length, which IGDB gives to online games', () => {
    expect(
      classifyGameType({ ...base, genres: ['Sport'], ttbMainMin: 7020 }),
    ).toEqual({ type: 'ENDLESS', reason: 'SPORTS' });
  });

  it('keeps a co-op campaign with a story as completable', () => {
    expect(
      classifyGameType({
        ...base,
        modes: ['Co-operative', 'Multiplayer'],
        storeCategories: ['Co-op', 'Multi-player', 'Online Co-op'],
        ttbMainMin: 670,
      }),
    ).toEqual({ type: 'COMPLETABLE', reason: 'STORY_LENGTH' });
  });

  it('does not take the Sandbox theme alone as a sandbox', () => {
    expect(
      classifyGameType({
        ...base,
        genres: ['Adventure', 'Role-playing (RPG)'],
        themes: ['Open world', 'Sandbox'],
        storeCategories: ['Single-player'],
        ttbMainMin: 1524,
      }).type,
    ).toBe('COMPLETABLE');
  });

  it('trusts IGDB on single player when Steam does not list player modes', () => {
    expect(
      classifyGameType({
        ...base,
        modes: ['Multiplayer', 'Single player'],
        genres: ['Simulator', 'Strategy'],
        storeCategories: ['Family Sharing'],
      }),
    ).toEqual({ type: 'SANDBOX', reason: 'STRATEGY_SIM' });
  });

  it('treats a music game as endless only without a story', () => {
    const music = {
      ...base,
      genres: ['Music'],
      storeCategories: ['Single-player'],
    };
    expect(classifyGameType(music).type).toBe('ENDLESS');
    expect(classifyGameType({ ...music, ttbMainMin: 600 }).type).toBe(
      'COMPLETABLE',
    );
  });

  it('answers UNKNOWN rather than guessing', () => {
    expect(classifyGameType(base)).toEqual({
      type: 'UNKNOWN',
      reason: 'NO_SIGNAL',
    });
  });
});
