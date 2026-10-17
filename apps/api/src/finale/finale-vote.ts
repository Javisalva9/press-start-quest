/** Fewer votes than this aren't a consensus: one person isn't 100 % agreement. */
export const MIN_VOTES = 5;

/** Share of votes that must agree for the consensus to win over the rules. */
export const AGREEMENT = 0.7;

export type FinaleSource = 'VOTE' | 'CONSENSUS' | 'RULE';

export interface FinaleInput {
  /** What the phrase rules say. */
  byRule: boolean;
  /** This player's vote, if any. */
  yourVote: boolean | null;
  /** Everyone's votes on it (this player's included). */
  votes: number;
  /** Of those, how many say it is a finale. */
  yes: number;
}

/**
 * Whether an achievement marks the end of its game, for one player: their
 * own vote; else everyone's, if enough agree; else the phrase rules.
 */
export function effectiveFinale(input: FinaleInput): {
  finale: boolean;
  source: FinaleSource;
} {
  if (input.yourVote !== null) {
    return { finale: input.yourVote, source: 'VOTE' };
  }
  if (input.votes >= MIN_VOTES) {
    const share = input.yes / input.votes;
    if (share >= AGREEMENT) {
      return { finale: true, source: 'CONSENSUS' };
    }
    if (1 - share >= AGREEMENT) {
      return { finale: false, source: 'CONSENSUS' };
    }
  }
  return { finale: input.byRule, source: 'RULE' };
}
