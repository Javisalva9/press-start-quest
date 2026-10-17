import { z } from 'zod';

/** A curator the player can follow, with what following would mean. */
export const CuratorSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** CREATOR: shared by everyone (AlexElCapso). FRIEND: one player's own. */
  kind: z.enum(['CREATOR', 'FRIEND']),
  /** Its label's color, as #RRGGBB. */
  color: z.string().nullable(),
  /** Games in its list. */
  games: z.number().int().nonnegative(),
  /** Of those, how many the player already owns. */
  owned: z.number().int().nonnegative(),
  following: z.boolean(),
});

export type CuratorSummary = z.infer<typeof CuratorSummarySchema>;

/** Response of GET /api/curators. */
export const CuratorsResponseSchema = z.object({
  curators: z.array(CuratorSummarySchema),
});

export type CuratorsResponse = z.infer<typeof CuratorsResponseSchema>;

/** A followed curator recommending a game: its label on the game. */
export const RecommendedBySchema = z.object({
  name: z.string(),
  color: z.string().nullable(),
});

export type RecommendedBy = z.infer<typeof RecommendedBySchema>;
