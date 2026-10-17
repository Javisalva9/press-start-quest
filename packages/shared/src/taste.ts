import { z } from 'zod';

/** One tag of the taste profile and how much it says about the player. */
export const TasteTagSchema = z.object({
  name: z.string(),
  /**
   * Positive: they like it; negative: what they tend to drop. Not on a
   * fixed scale: compare a tag with the others, not with a number.
   */
  score: z.number(),
});

export type TasteTag = z.infer<typeof TasteTagSchema>;

/**
 * Response of GET /api/taste-profile: what the app has learned from what
 * the player plays, favourites first, by kind of tag.
 */
export const TasteProfileSchema = z.object({
  /** Last time it was worked out; null while it's still empty. */
  updatedAt: z.iso.datetime().nullable(),
  genres: z.array(TasteTagSchema),
  themes: z.array(TasteTagSchema),
  modes: z.array(TasteTagSchema),
  perspectives: z.array(TasteTagSchema),
});

export type TasteProfile = z.infer<typeof TasteProfileSchema>;
