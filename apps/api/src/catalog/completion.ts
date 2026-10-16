import { CompletionSignal, GameType } from '../generated/prisma/client.js';

/** Confidence saved in user_games.completionConfidence. */
export const HIGH_CONFIDENCE = 0.9;
export const MEDIUM_CONFIDENCE = 0.6;

/** Share of the main story's length that suggests the game is finished. */
export const PLAYTIME_SHARE = 0.8;

export interface CompletionInput {
  /** The player's override if any, else the catalog's type. */
  gameType: GameType;
  playtimeMin: number;
  /** Main story only: finishing means reaching the credits. */
  ttbMainMin: number | null;
  achievementsUnlocked: number | null;
  achievementsTotal: number | null;
  /** Whether the player unlocked a "finish the game" achievement. */
  finaleUnlocked: boolean;
}

/**
 * Whether a game looks finished, and why. Never a verdict: it only puts
 * the game in the queue for the player to confirm.
 *
 * Strongest signal first. Achievements count for any game with an ending
 * (completable, sandbox, unknown); playtime only for completable ones, as a
 * sandbox's "length" says nothing about its goal. Endless games are never
 * "finished".
 */
export function detectCompletion(
  game: CompletionInput,
): { signal: CompletionSignal; confidence: number } | null {
  if (game.gameType === GameType.ENDLESS) {
    return null;
  }
  const total = game.achievementsTotal ?? 0;
  if (total > 0 && game.achievementsUnlocked === total) {
    return {
      signal: CompletionSignal.ALL_ACHIEVEMENTS,
      confidence: HIGH_CONFIDENCE,
    };
  }
  if (game.finaleUnlocked) {
    return {
      signal: CompletionSignal.FINALE_ACHIEVEMENT,
      confidence: HIGH_CONFIDENCE,
    };
  }
  if (
    game.gameType === GameType.COMPLETABLE &&
    game.ttbMainMin &&
    game.playtimeMin >= PLAYTIME_SHARE * game.ttbMainMin
  ) {
    return { signal: CompletionSignal.PLAYTIME, confidence: MEDIUM_CONFIDENCE };
  }
  return null;
}
