import { GameStatus, GameType } from '../generated/prisma/client.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Played within this many days: "playing". */
export const PLAYING_DAYS = 30;

/** Less playtime than this is a try, not a start: still "backlog". */
export const STARTED_MIN = 60;

/** Paused this long: the queue asks "did you drop it?". */
export const ASK_ABANDONED_DAYS = 90;

export interface AutoStatusInput {
  playtimeMin: number;
  /** Last session on any store; null if the store doesn't say. */
  lastPlayedAt: Date | null;
  /** The player's override if any, else the catalog's type. */
  gameType: GameType;
}

/**
 * The status the app sets by itself, for games whose status the player
 * hasn't set. One threshold, so every game falls in exactly one:
 *
 * - Less than an hour played: backlog (opened once to try it).
 * - Played in the last 30 days: playing.
 * - Played, but not lately: on hold. Never "abandoned": that's an opinion
 *   (it weighs against the game's tags in the taste profile), so only the
 *   player says it, when the queue asks after 3 months.
 *
 * Endless games are never "on hold": playing or not, they don't count in
 * the progress chart, so they go back to backlog.
 */
export function autoStatus(game: AutoStatusInput, now: Date): GameStatus {
  if (game.playtimeMin < STARTED_MIN) {
    return GameStatus.BACKLOG;
  }
  if (game.lastPlayedAt && daysSince(game.lastPlayedAt, now) <= PLAYING_DAYS) {
    return GameStatus.PLAYING;
  }
  return game.gameType === GameType.ENDLESS
    ? GameStatus.BACKLOG
    : GameStatus.ON_HOLD;
}

/** Whether a paused game has been paused long enough to ask about it. */
export function pausedLongEnough(
  lastPlayedAt: Date | null,
  now: Date,
): boolean {
  // No date: played so long ago that Steam doesn't know when.
  return (
    lastPlayedAt === null || daysSince(lastPlayedAt, now) >= ASK_ABANDONED_DAYS
  );
}

function daysSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / DAY_MS;
}
