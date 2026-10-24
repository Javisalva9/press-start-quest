import { qualityFactor } from '../recommendations/scoring.js';

/**
 * What makes a deal worth it for this player, adding up to 1: that it's
 * their kind of game and a good one weighs more than the discount, or
 * the list would be led by cheap games they don't care about.
 */
export const DEAL_WEIGHTS = {
  fit: 0.3,
  quality: 0.25,
  cut: 0.2,
  historicalLow: 0.15,
  curators: 0.1,
} as const;

export interface DealCandidate {
  /** 0–1, against the rest of the list. */
  fit: number;
  rating: number | null;
  ratingCount: number | null;
  metacritic: number | null;
  cutPct: number;
  isHistoricalLow: boolean;
  /** Recommended by a curator the player follows. */
  recommended: boolean;
}

/** The "for you" score of a deal, 0–1. */
export function dealScore(deal: DealCandidate): number {
  const score =
    DEAL_WEIGHTS.fit * deal.fit +
    DEAL_WEIGHTS.quality * qualityFactor(deal) +
    DEAL_WEIGHTS.cut * (deal.cutPct / 100) +
    DEAL_WEIGHTS.historicalLow * (deal.isHistoricalLow ? 1 : 0) +
    DEAL_WEIGHTS.curators * (deal.recommended ? 1 : 0);
  return Math.round(score * 1000) / 1000;
}
