import { z } from 'zod';
import { OWNED_STATUSES } from './library.js';

/** Query string of GET /api/games/search. */
export const GameSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

export type GameSearchQuery = z.infer<typeof GameSearchQuerySchema>;

/** One PC game found on IGDB. */
export const GameSearchResultSchema = z.object({
  igdbId: z.number().int(),
  title: z.string(),
  releaseYear: z.number().int().nullable(),
  coverUrl: z.string().nullable(),
  /** Already in the player's library: owned, wished for, or not. */
  inLibrary: z.enum(['owned', 'wishlist']).nullable(),
});

export type GameSearchResult = z.infer<typeof GameSearchResultSchema>;

export const GameSearchResponseSchema = z.object({
  results: z.array(GameSearchResultSchema),
});

export type GameSearchResponse = z.infer<typeof GameSearchResponseSchema>;

/**
 * Body of POST /api/library/manual: a game from the search, either wished
 * for or owned somewhere outside the synced stores ("Jack Sparrow").
 */
export const AddManualGameRequestSchema = z.discriminatedUnion('origin', [
  z.object({
    origin: z.literal('wishlist'),
    igdbId: z.number().int().positive(),
  }),
  z.object({
    origin: z.literal('external'),
    igdbId: z.number().int().positive(),
    /** An existing external source's name, or a new one. */
    sourceName: z.string().trim().min(1).max(40),
    /** These stores don't sync: the player says how long they've played. */
    playtimeMinutes: z.number().int().min(0).max(1_000_000).optional(),
    /** Left out: the app works it out. */
    status: z.enum(OWNED_STATUSES).optional(),
  }),
]);

export type AddManualGameRequest = z.infer<typeof AddManualGameRequestSchema>;

/** A store the player added by hand, with no sync: "Jack Sparrow", "Epic"… */
export const ExternalSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  games: z.number().int().nonnegative(),
});

export type ExternalSource = z.infer<typeof ExternalSourceSchema>;

export const ExternalSourcesResponseSchema = z.object({
  sources: z.array(ExternalSourceSchema),
});

export type ExternalSourcesResponse = z.infer<
  typeof ExternalSourcesResponseSchema
>;
