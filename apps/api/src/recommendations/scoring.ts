import {
  DEFAULT_WEIGHTS,
  weightShares,
  type Mood,
  type RecommendationFactors,
  type RecommendationReason,
} from '@psq/shared';

/** How much each factor counts, 0–1, adding up to 1. */
export type Weights = Record<keyof RecommendationFactors, number>;

/**
 * The plan's formula: 0.30 N + 0.30 A + 0.20 D + 0.10 S + 0.10 I. Each
 * player can change it in Settings (users.settings).
 */
export const WEIGHTS: Weights = weightShares(DEFAULT_WEIGHTS);

/** Extra for a game whose servers are about to close: play it while you can. */
export const CLOSING_BONUS = 0.1;

/** Quality of a game nobody rated: neither praised nor punished. */
export const NEUTRAL_QUALITY = 0.7;

/**
 * Ratings count as this many votes of NEUTRAL_QUALITY: a 100 from 3 votes
 * ends up near 0.75, a 90 from 2,000 stays at 0.9.
 */
const PRIOR_VOTES = 10;

/** The length each mood aims for (what's left, in hours), and how strictly. */
const LENGTH_CURVES: Record<Mood | 'none', { hours: number; spread: number }> =
  {
    short: { hours: 5, spread: 0.7 },
    medium: { hours: 18, spread: 0.45 },
    long: { hours: 45, spread: 0.6 },
    // No mood: 8–25 h, enough to build up momentum.
    none: { hours: 15, spread: 0.75 },
  };

/** The bounds of each mood, in minutes left: [from, to). */
export const MOOD_RANGES: Record<Mood, [number, number]> = {
  short: [0, 10 * 60],
  medium: [10 * 60, 30 * 60 + 1],
  long: [30 * 60 + 1, Number.POSITIVE_INFINITY],
};

/** Without a mood, a game with no known length is a fair, middling fit. */
const UNKNOWN_LENGTH = 0.4;

/** Momentum: started, not nearly finished, and played in this many days. */
const MOMENTUM_DAYS = 90;
const MOMENTUM_MIN_PLAYED = 60;
const MOMENTUM_MAX_SHARE = 0.8;

/** Below these, a factor isn't worth telling the player about. */
const REASON_MIN = { quality: 0.85, affinity: 0.5, length: 0.6 } as const;

/**
 * What's ordinary for each factor. Reasons are ranked by how far above it
 * a game is, not by the raw weight: most games rate around 0.7–0.8, so
 * "rated 85" would otherwise beat "your kind of game" on almost every card.
 */
const ORDINARY = { quality: NEUTRAL_QUALITY, length: UNKNOWN_LENGTH } as const;

export interface Candidate {
  playtimeMin: number;
  /** Its status is "playing": the app's, or the player's own word. */
  playing: boolean;
  lastPlayedAt: Date | null;
  /** Main story length (or the player's own estimate), in minutes. */
  lengthMin: number | null;
  /** Sandboxes have no length to finish: theirs says nothing. */
  sandbox: boolean;
  /** IGDB's total rating, 0–100, and how many ratings it has. */
  rating: number | null;
  ratingCount: number | null;
  metacritic: number | null;
  /** 0–1, already compared with the other candidates. */
  affinity: number;
  /** The tag that fits the player's taste the most, if any. */
  topTag: {
    name: string;
    kind: 'GENRE' | 'THEME' | 'MODE' | 'PERSPECTIVE';
  } | null;
  /** Followed curators that recommend it. */
  curators: string[];
  /** Servers about to close (and when, if known). */
  closing: { at: Date | null } | null;
}

export interface Scored {
  score: number;
  factors: RecommendationFactors;
  remainingMin: number | null;
  reasons: RecommendationReason[];
}

/** What's left of the main story; null when there's no length to go by. */
export function remainingMinutes(candidate: Candidate): number | null {
  if (candidate.sandbox || candidate.lengthMin === null) {
    return null;
  }
  return Math.max(0, candidate.lengthMin - candidate.playtimeMin);
}

/**
 * Whether a game can be offered for a mood. With one, only games whose
 * length is known and fits: a sandbox or an unknown length can't promise
 * "short".
 */
export function fitsMood(candidate: Candidate, mood: Mood | null): boolean {
  if (!mood) {
    return true;
  }
  const left = remainingMinutes(candidate);
  if (left === null) {
    return false;
  }
  const [from, to] = MOOD_RANGES[mood];
  return left >= from && left < to;
}

/** N: IGDB's rating pulled towards neutral when few voted; else Metacritic. */
export function qualityFactor(
  candidate: Pick<Candidate, 'rating' | 'ratingCount' | 'metacritic'>,
): number {
  if (candidate.rating !== null) {
    const votes = candidate.ratingCount ?? 0;
    const rating = candidate.rating / 100;
    return (
      (votes * rating + PRIOR_VOTES * NEUTRAL_QUALITY) / (votes + PRIOR_VOTES)
    );
  }
  if (candidate.metacritic !== null) {
    return candidate.metacritic / 100;
  }
  return NEUTRAL_QUALITY;
}

/**
 * D: a bell curve on a log scale around the mood's length: 3 h left and
 * 12 h left are as far from 6 h. A game a few minutes from its end counts
 * as half an hour left.
 */
export function lengthFactor(candidate: Candidate, mood: Mood | null): number {
  const left = remainingMinutes(candidate);
  if (left === null) {
    return mood ? 0 : UNKNOWN_LENGTH;
  }
  const { hours, spread } = LENGTH_CURVES[mood ?? 'none'];
  const distance = Math.log(Math.max(left, 30) / 60) - Math.log(hours);
  return Math.exp(-(distance * distance) / (2 * spread * spread));
}

/**
 * I: started, not nearly finished, and played in the last 90 days.
 * Started is over an hour, or "playing": a game from an external source
 * has no hours, only the player's word.
 */
export function momentumFactor(candidate: Candidate, now: Date): boolean {
  const started =
    candidate.playing || candidate.playtimeMin > MOMENTUM_MIN_PLAYED;
  if (!started || !candidate.lastPlayedAt) {
    return false;
  }
  const days = (now.getTime() - candidate.lastPlayedAt.getTime()) / 86_400_000;
  if (days > MOMENTUM_DAYS) {
    return false;
  }
  return (
    candidate.lengthMin === null ||
    candidate.sandbox ||
    candidate.playtimeMin < candidate.lengthMin * MOMENTUM_MAX_SHARE
  );
}

/** The score of one candidate, with its factors and why. */
export function scoreCandidate(
  candidate: Candidate,
  mood: Mood | null,
  now: Date,
  weights: Weights = WEIGHTS,
): Scored {
  const factors: RecommendationFactors = {
    quality: qualityFactor(candidate),
    affinity: clamp(candidate.affinity),
    length: lengthFactor(candidate, mood),
    social: candidate.curators.length > 0 ? 1 : 0,
    momentum: momentumFactor(candidate, now) ? 1 : 0,
  };
  const weighted = (Object.keys(weights) as Array<keyof Weights>).reduce(
    (total, key) => total + weights[key] * factors[key],
    0,
  );
  const score = weighted + (candidate.closing ? CLOSING_BONUS : 0);
  const remainingMin = remainingMinutes(candidate);
  return {
    score: round(score),
    factors: {
      quality: round(factors.quality),
      affinity: round(factors.affinity),
      length: round(factors.length),
      social: factors.social,
      momentum: factors.momentum,
    },
    remainingMin,
    reasons: reasons(candidate, factors, remainingMin, weights),
  };
}

/**
 * The two factors that stand out the most and are worth saying. Closing
 * servers go first: it's the one that can't wait.
 */
function reasons(
  candidate: Candidate,
  factors: RecommendationFactors,
  remainingMin: number | null,
  weights: Weights,
): RecommendationReason[] {
  const options: Array<{ weight: number; reason: RecommendationReason }> = [];
  if (candidate.closing) {
    options.push({
      weight: Number.POSITIVE_INFINITY,
      reason: {
        code: 'SERVERS_CLOSING',
        closesAt: candidate.closing.at?.toISOString() ?? null,
      },
    });
  }
  if (candidate.topTag && factors.affinity >= REASON_MIN.affinity) {
    options.push({
      weight: weights.affinity * factors.affinity,
      reason: {
        code: 'TASTE_MATCH',
        tag: candidate.topTag.name,
        kind: candidate.topTag.kind,
      },
    });
  }
  // "You're 40 % in" only with hours to show: never "0 %".
  if (factors.momentum && candidate.playtimeMin > MOMENTUM_MIN_PLAYED) {
    const percent =
      candidate.lengthMin && !candidate.sandbox
        ? Math.min(
            99,
            Math.round((candidate.playtimeMin / candidate.lengthMin) * 100),
          )
        : null;
    options.push({
      weight: weights.momentum * factors.momentum,
      reason: {
        code: 'KEEP_GOING',
        playedMinutes: candidate.playtimeMin,
        percent,
      },
    });
  }
  if (remainingMin !== null && factors.length >= REASON_MIN.length) {
    options.push({
      weight: weights.length * (factors.length - ORDINARY.length),
      reason: { code: 'TIME_LEFT', minutes: remainingMin },
    });
  }
  if (factors.social) {
    options.push({
      weight: weights.social * factors.social,
      reason: { code: 'RECOMMENDED_BY', curator: candidate.curators[0]! },
    });
  }
  const rating = candidate.rating ?? candidate.metacritic;
  if (rating !== null && factors.quality >= REASON_MIN.quality) {
    options.push({
      weight: weights.quality * (factors.quality - ORDINARY.quality),
      reason: { code: 'HIGHLY_RATED', rating: Math.round(rating) },
    });
  }
  // A factor the player set to 0 doesn't count: it's no reason either.
  return options
    .filter(({ weight }) => weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map(({ reason }) => reason);
}

/** Genres that say nothing about what a game is like. */
const GENERIC_GENRES = new Set(['Indie']);

/**
 * The alternatives: the best games that share less than half of their
 * genres with every game already picked, so the plan B is a real change.
 * If too few are different enough, the best of the rest fill the gaps.
 */
export function pickAlternatives<T extends { genres: string[] }>(
  picked: T,
  ranked: T[],
  count: number,
): T[] {
  const chosen: T[] = [];
  const differs = (game: T) =>
    [picked, ...chosen].every(
      (other) => overlap(game.genres, other.genres) < 0.5,
    );
  for (const game of ranked) {
    if (chosen.length === count) {
      break;
    }
    if (game !== picked && differs(game)) {
      chosen.push(game);
    }
  }
  for (const game of ranked) {
    if (chosen.length === count) {
      break;
    }
    if (game !== picked && !chosen.includes(game)) {
      chosen.push(game);
    }
  }
  return chosen;
}

/** Share of a game's own genres (generic ones aside) that the other has too. */
export function overlap(genres: string[], other: string[]): number {
  const own = genres.filter((genre) => !GENERIC_GENRES.has(genre));
  if (own.length === 0) {
    return 0;
  }
  const theirs = new Set(other);
  return own.filter((genre) => theirs.has(genre)).length / own.length;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
