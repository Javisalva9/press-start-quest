import { z } from 'zod';

/** Same values as the CompletionSignal enum in the database. */
export const COMPLETION_SIGNALS = [
  'ALL_ACHIEVEMENTS',
  'FINALE_ACHIEVEMENT',
  'PLAYTIME',
] as const;

export const CompletionSignalSchema = z.enum(COMPLETION_SIGNALS);

export type CompletionSignal = z.infer<typeof CompletionSignalSchema>;

/** Query string of GET /api/library/review-queue. */
export const ReviewQueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ReviewQueueQuery = z.infer<typeof ReviewQueueQuerySchema>;

/** One card of the confirmation queue: "did you finish it?". */
export const ReviewCardSchema = z.object({
  /** Id of the library entry. */
  id: z.string(),
  title: z.string(),
  coverUrl: z.string().nullable(),
  heroUrl: z.string().nullable(),
  playtimeMinutes: z.number().int().nonnegative(),
  /** Main story length in minutes, what the playtime signal compares to. */
  mainStoryMinutes: z.number().int().nullable(),
  achievements: z
    .object({ unlocked: z.number().int(), total: z.number().int() })
    .nullable(),
  /** Why it looks finished; null if it's here only because it was played. */
  signal: CompletionSignalSchema.nullable(),
  /** 0–1. */
  confidence: z.number().nullable(),
  /** The finale achievement behind a FINALE_ACHIEVEMENT signal. */
  finaleAchievement: z
    .object({ name: z.string(), description: z.string() })
    .nullable(),
});

export type ReviewCard = z.infer<typeof ReviewCardSchema>;

/** Response of GET /api/library/review-queue. */
export const ReviewQueueSchema = z.object({
  items: z.array(ReviewCardSchema),
  /** Cards waiting, including those beyond the limit. */
  total: z.number().int().nonnegative(),
});

export type ReviewQueue = z.infer<typeof ReviewQueueSchema>;

/**
 * The answers on a card: finished it, not (yet), left it, won't play it.
 * Same order as the swipes: right, left, down, up.
 */
export const REVIEW_ANSWERS = [
  'finished',
  'notFinished',
  'abandoned',
  'wontPlay',
] as const;

/** Body of POST /api/library/review-queue/:id. */
export const ReviewAnswerRequestSchema = z.object({
  answer: z.enum(REVIEW_ANSWERS),
});

export type ReviewAnswerRequest = z.infer<typeof ReviewAnswerRequestSchema>;
