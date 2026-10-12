import { GameKind } from '../generated/prisma/client.js';

/**
 * Steam mixes in the library things that aren't games to play: Playtests,
 * demos, soundtracks, dedicated servers… Only GameKind.GAME shows up.
 */

/** Steam Store `type` values other than "game", and what they are. */
const STORE_TYPES: Record<string, GameKind> = {
  mod: GameKind.GAME,
  dlc: GameKind.DLC,
  demo: GameKind.DEMO,
  music: GameKind.SOUNDTRACK,
};

/** Names that give away entries labelled "game" (or without a store page). */
const NAME_RULES: Array<[RegExp, GameKind]> = [
  [/\bplaytest\b/i, GameKind.PLAYTEST],
  [/\b(soundtrack|ost)\b/i, GameKind.SOUNDTRACK],
  // Only at the end ("Hades Demo", "Foo (Demo)"), so "Demon's Souls" is safe.
  [/\bdemo\)?\s*$/i, GameKind.DEMO],
  [
    /\b(dedicated server|test server|public test|sdk|mod tools|benchmark)\b/i,
    GameKind.TOOL,
  ],
];

export function classifyGameKind({
  title,
  storeType,
}: {
  title: string;
  /** Steam Store `type`, when the app has a store page. */
  storeType?: string | null;
}): GameKind {
  // 1. The store knows best, except when it says "game": Playtests and
  //    servers are labelled that way too.
  if (storeType && storeType !== 'game') {
    // Videos, series, hardware, ads…: not something to play.
    return STORE_TYPES[storeType] ?? GameKind.TOOL;
  }
  // 2. A "game" or no store page at all: the name may still give it away.
  for (const [pattern, kind] of NAME_RULES) {
    if (pattern.test(title)) {
      return kind;
    }
  }
  return GameKind.GAME;
}
