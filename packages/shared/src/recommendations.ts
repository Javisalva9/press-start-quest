import { z } from 'zod';

/**
 * How much time the player feels like committing, by what's left of each
 * game: short < 10 h, medium 10–30 h, long > 30 h. No mood: anything goes.
 */
export const MOODS = ['short', 'medium', 'long'] as const;

export const MoodSchema = z.enum(MOODS);

export type Mood = z.infer<typeof MoodSchema>;

/** Query string of GET /api/recommendations/next. */
export const NextRecommendationQuerySchema = z.object({
  mood: MoodSchema.optional(),
  /** "Another one": how many of the best to skip for the main pick. */
  skip: z.coerce.number().int().min(0).max(50).default(0),
});

export type NextRecommendationQuery = z.infer<
  typeof NextRecommendationQuerySchema
>;

/** Query string of GET /api/recommendations/ranking. */
export const RecommendationRankingQuerySchema = z.object({
  mood: MoodSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type RecommendationRankingQuery = z.infer<
  typeof RecommendationRankingQuerySchema
>;

/** Tag kinds a taste can be about. */
export const TASTE_KINDS = ['GENRE', 'THEME', 'MODE', 'PERSPECTIVE'] as const;

/**
 * Why a game is recommended, as codes with their values: the web app
 * writes the sentence in the player's language.
 */
export const RecommendationReasonSchema = z.discriminatedUnion('code', [
  /** "Your kind of game: metroidvania" (the tag that fits the most). */
  z.object({
    code: z.literal('TASTE_MATCH'),
    tag: z.string(),
    kind: z.enum(TASTE_KINDS),
  }),
  /** "About 12 h left". */
  z.object({ code: z.literal('TIME_LEFT'), minutes: z.number().int() }),
  /** "You're 40 % in": started, played lately, not finished. */
  z.object({
    code: z.literal('KEEP_GOING'),
    playedMinutes: z.number().int(),
    /** Share of the main story played, 0–100; null if its length is unknown. */
    percent: z.number().int().nullable(),
  }),
  /** "Rated 92". */
  z.object({ code: z.literal('HIGHLY_RATED'), rating: z.number().int() }),
  /** "AlexElCapso recommends it". */
  z.object({ code: z.literal('RECOMMENDED_BY'), curator: z.string() }),
  /** "Play it before its servers close". */
  z.object({
    code: z.literal('SERVERS_CLOSING'),
    closesAt: z.iso.datetime().nullable(),
  }),
]);

export type RecommendationReason = z.infer<typeof RecommendationReasonSchema>;

/** Each factor of the score, 0–1, before the weights. */
export const RecommendationFactorsSchema = z.object({
  /** N: how good the game is. */
  quality: z.number(),
  /** A: how well it fits the player's taste. */
  affinity: z.number(),
  /** D: how well what's left of it fits the mood. */
  length: z.number(),
  /** S: a followed curator recommends it. */
  social: z.number(),
  /** I: started, played lately, not finished. */
  momentum: z.number(),
});

export type RecommendationFactors = z.infer<typeof RecommendationFactorsSchema>;

/** One recommended game. */
export const RecommendationSchema = z.object({
  /** Id of the library entry. */
  id: z.string(),
  title: z.string(),
  coverUrl: z.string().nullable(),
  heroUrl: z.string().nullable(),
  /** To launch it in Steam (steam://run/…). */
  steamAppId: z.number().int().nullable(),
  playtimeMinutes: z.number().int().nonnegative(),
  /** Main story left; null if its length is unknown or it's a sandbox. */
  remainingMinutes: z.number().int().nonnegative().nullable(),
  genres: z.array(z.string()),
  /** 0–1 (a little more for a game whose servers are about to close). */
  score: z.number(),
  factors: RecommendationFactorsSchema,
  /** The two that weighed the most, the strongest first. */
  reasons: z.array(RecommendationReasonSchema),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

/** Response of GET /api/recommendations/next. */
export const NextRecommendationSchema = z.object({
  mood: MoodSchema.nullable(),
  /** Null when nothing fits (empty backlog, or nothing of that length). */
  pick: RecommendationSchema.nullable(),
  /** Up to two of other genres: a plan B, not a menu. */
  alternatives: z.array(RecommendationSchema),
  /** Games that fit: how far "another one" can go. */
  candidates: z.number().int().nonnegative(),
});

export type NextRecommendation = z.infer<typeof NextRecommendationSchema>;

/** Response of GET /api/recommendations/ranking: to tune the weights. */
export const RecommendationRankingSchema = z.object({
  mood: MoodSchema.nullable(),
  items: z.array(RecommendationSchema),
  candidates: z.number().int().nonnegative(),
});

export type RecommendationRanking = z.infer<typeof RecommendationRankingSchema>;

/**
 * The player's answer to a recommendation: "not now" hides it for a while,
 * "I won't play it" takes it out of the backlog for good.
 */
export const RECOMMENDATION_FEEDBACK = ['NOT_NOW', 'NEVER'] as const;

export type RecommendationFeedbackAction =
  (typeof RECOMMENDATION_FEEDBACK)[number];

/** Body of POST /api/recommendations/:id/feedback. */
export const RecommendationFeedbackRequestSchema = z.object({
  action: z.enum(RECOMMENDATION_FEEDBACK),
  /** The mood of the card that was answered: it was ranked with it. */
  mood: MoodSchema.nullable().default(null),
});

export type RecommendationFeedbackRequest = z.infer<
  typeof RecommendationFeedbackRequestSchema
>;

/** Response of POST /api/recommendations/:id/feedback. */
export const RecommendationFeedbackSchema = z.object({
  action: z.enum(RECOMMENDATION_FEEDBACK),
  /** With "not now": the day it can be recommended again. */
  snoozedUntil: z.iso.datetime().nullable(),
});

export type RecommendationFeedback = z.infer<
  typeof RecommendationFeedbackSchema
>;
