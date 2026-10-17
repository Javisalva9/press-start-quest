import type { GameAchievement } from '@psq/shared';

export type FinaleActionKey =
  | 'achievements.markFinale'
  | 'achievements.markNotFinale'
  | 'achievements.takeBackVote';

/**
 * The one button on an achievement: vote the opposite of what it is now,
 * or take back the vote already given (so the community or the rules
 * decide again).
 */
export function finaleAction(finale: GameAchievement['finale']): {
  key: FinaleActionKey;
  vote: boolean | null;
} {
  if (finale.yourVote !== null) {
    return { key: 'achievements.takeBackVote', vote: null };
  }
  return finale.isFinale
    ? { key: 'achievements.markNotFinale', vote: false }
    : { key: 'achievements.markFinale', vote: true };
}

export type FinaleSourceKey =
  'achievements.byYou' | 'achievements.byCommunity' | 'achievements.byRules';

/** Who says it's the ending, for the label next to "Ending". */
export function finaleSourceKey(
  source: GameAchievement['finale']['source'],
): FinaleSourceKey {
  switch (source) {
    case 'VOTE':
      return 'achievements.byYou';
    case 'CONSENSUS':
      return 'achievements.byCommunity';
    case 'RULE':
      return 'achievements.byRules';
  }
}
