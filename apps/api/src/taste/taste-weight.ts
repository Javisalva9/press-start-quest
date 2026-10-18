import { GameStatus, TagKind } from '../generated/prisma/client.js';

/**
 * How much each game says about the player's taste. Set by hand, and the
 * numbers to revisit after using the app for a while.
 */
export const TASTE_WEIGHTS = {
  /** Finished: the clearest sign they liked it. */
  completed: 1,
  /**
   * Otherwise, hours played count on a log curve up to this many: the
   * first hours say the most, and 500 h of one game can't drown the rest.
   */
  fullWeightHours: 50,
  /** Dropped after giving it a real try: something in it didn't work. */
  abandoned: -0.3,
  abandonedAfterMin: 120,
  /**
   * The player's own stars on a completed game, which win over the plain
   * completion: 3 stars is the same as no stars, 1 star counts against.
   * Half stars fall in between (3.5 → 1.125); half a star counts as one.
   */
  stars: [
    [1, -0.5],
    [2, 0.4],
    [3, 1],
    [4, 1.25],
    [5, 1.5],
  ] as ReadonlyArray<readonly [stars: number, weight: number]>,
} as const;

/**
 * The tags that make up a taste. Steam's store categories are left out:
 * "Steam Cloud" or "Family Sharing" say nothing about what someone likes.
 */
export const TASTE_TAG_KINDS = [
  TagKind.GENRE,
  TagKind.THEME,
  TagKind.MODE,
  TagKind.PERSPECTIVE,
] as const;

export interface TasteInput {
  status: GameStatus;
  playtimeMin: number;
  /** The player's stars, 0.5–5, or null. */
  stars: number | null;
}

/**
 * The weight of one owned game in the taste profile. 0 means it says
 * nothing: never played, or "I won't play it".
 */
export function tasteWeight({
  status,
  playtimeMin,
  stars,
}: TasteInput): number {
  switch (status) {
    case GameStatus.COMPLETED:
      return stars !== null ? starsWeight(stars) : TASTE_WEIGHTS.completed;
    case GameStatus.ABANDONED:
      return playtimeMin > TASTE_WEIGHTS.abandonedAfterMin
        ? TASTE_WEIGHTS.abandoned
        : 0;
    case GameStatus.DISCARDED:
    case GameStatus.WISHLIST:
      return 0;
    default:
      return hoursWeight(playtimeMin);
  }
}

/** The weight of some stars, in a straight line between the whole ones. */
export function starsWeight(stars: number): number {
  const points = TASTE_WEIGHTS.stars;
  const [first] = points;
  if (stars <= first![0]) {
    return first![1];
  }
  for (let i = 1; i < points.length; i += 1) {
    const [toStars, toWeight] = points[i]!;
    if (stars <= toStars) {
      const [fromStars, fromWeight] = points[i - 1]!;
      return (
        fromWeight +
        ((toWeight - fromWeight) * (stars - fromStars)) / (toStars - fromStars)
      );
    }
  }
  return points.at(-1)![1];
}

/** log(1 + h) / log(1 + 50): 0 h → 0, 1 h → 0.18, 10 h → 0.61, 50 h or more → 1. */
export function hoursWeight(playtimeMin: number): number {
  const hours = Math.max(0, playtimeMin) / 60;
  return Math.min(
    1,
    Math.log1p(hours) / Math.log1p(TASTE_WEIGHTS.fullWeightHours),
  );
}
