import { GameType } from '../generated/prisma/client.js';

/** What the catalog knows about a game, as stored in its tags. */
export interface GameTypeInput {
  /** IGDB game modes: "Single player", "Battle Royale"… */
  modes: string[];
  /** IGDB genres (Steam's when IGDB doesn't know the game). */
  genres: string[];
  /** IGDB themes: "Sandbox", "Open world"… */
  themes: string[];
  /** Steam Store categories: "Single-player", "Online PvP"… */
  storeCategories: string[];
  /** Length of the main story, in minutes; null if unknown. */
  ttbMainMin: number | null;
}

/** Which rule decided: shown in logs and tests, so a wrong type is easy to trace. */
export type GameTypeReason =
  | 'BATTLE_ROYALE_OR_MMO'
  | 'MOBA'
  | 'SPORTS'
  | 'RHYTHM'
  | 'MULTIPLAYER_ONLY'
  | 'SANDBOX_THEME'
  | 'STRATEGY_SIM'
  | 'ONLINE_PVP'
  | 'STORY_LENGTH'
  | 'NARRATIVE_GENRE'
  | 'NO_SIGNAL';

/** Genres that mean a game is played for its story or its levels. */
const NARRATIVE_GENRES = new Set([
  'Adventure',
  'Role-playing (RPG)',
  'Visual Novel',
  'Point-and-click',
  'Platform',
  'Puzzle',
]);

/**
 * Completable (has an ending to aim for), endless (online competitive, MMO,
 * party, rhythm…) or sandbox (no ending you have to reach).
 *
 * Rules in order, the first that matches wins. The order matters: IGDB
 * gives a "story length" to online games (Rocket League: 117 h), so the
 * clearly endless ones go first; and the Sandbox theme alone isn't enough
 * (Skyrim and Tomb Raider have it).
 *
 * Tuned on a real library of 64 games (game-type.fixtures.json). What the
 * data can't tell apart (a co-op game with an ending from one without) is
 * left for the player to fix by hand: their override always wins.
 */
export function classifyGameType(game: GameTypeInput): {
  type: GameType;
  reason: GameTypeReason;
} {
  const modes = new Set(game.modes);
  const genres = new Set(game.genres);
  const themes = new Set(game.themes);
  const store = new Set(game.storeCategories);
  const hasStory = game.ttbMainMin !== null;

  // Steam sometimes barely describes a game (only "Family Sharing"): its
  // silence about single player only counts if it lists the player modes.
  const storeListsPlayers =
    store.has('Single-player') || store.has('Multi-player');
  const singlePlayer = storeListsPlayers
    ? store.has('Single-player')
    : modes.has('Single player');
  // Without any of that, "not single player" would just mean "no data".
  const knowsPlayers = storeListsPlayers || modes.size > 0;
  const pvp = store.has('Online PvP') || store.has('PvP');
  const coop = store.has('Co-op') || store.has('Online Co-op');

  const endless = (reason: GameTypeReason) => ({
    type: GameType.ENDLESS,
    reason,
  });

  if (
    modes.has('Battle Royale') ||
    modes.has('Massively Multiplayer Online (MMO)') ||
    store.has('MMO')
  ) {
    return endless('BATTLE_ROYALE_OR_MMO');
  }
  if (genres.has('MOBA')) {
    return endless('MOBA');
  }
  if (genres.has('Sport')) {
    return endless('SPORTS');
  }
  // Beat Saber, Guitar Hero…: played for the score. A music game with a
  // story (Hi-Fi Rush) has a length and doesn't stop here.
  if (genres.has('Music') && !hasStory) {
    return endless('RHYTHM');
  }
  // Not for one player: competitive or party, unless it's a co-op campaign
  // with a story (It Takes Two).
  if (knowsPlayers && !singlePlayer && (pvp || !coop || !hasStory)) {
    return endless('MULTIPLAYER_ONLY');
  }
  if (
    themes.has('Sandbox') &&
    (genres.has('Simulator') ||
      (themes.has('Survival') && themes.has('Open world')))
  ) {
    return { type: GameType.SANDBOX, reason: 'SANDBOX_THEME' };
  }
  // Grand strategy and colony sims: Total War, Civilization…
  if (genres.has('Simulator') && genres.has('Strategy') && !hasStory) {
    return { type: GameType.SANDBOX, reason: 'STRATEGY_SIM' };
  }
  if (store.has('Online PvP') && !hasStory) {
    return endless('ONLINE_PVP');
  }
  if (hasStory) {
    return { type: GameType.COMPLETABLE, reason: 'STORY_LENGTH' };
  }
  if (
    singlePlayer &&
    game.genres.some((genre) => NARRATIVE_GENRES.has(genre))
  ) {
    return { type: GameType.COMPLETABLE, reason: 'NARRATIVE_GENRE' };
  }
  // Better "don't know" than a guess.
  return { type: GameType.UNKNOWN, reason: 'NO_SIGNAL' };
}
