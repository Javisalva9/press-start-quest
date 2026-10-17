import { z } from 'zod';

/** Who decided that an achievement marks the end of its game. */
export const FINALE_SOURCES = ['VOTE', 'CONSENSUS', 'RULE'] as const;

/** One achievement of a game, with whether it marks its end for the player. */
export const GameAchievementSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Empty for hidden achievements. */
  description: z.string(),
  /** Null while it's still locked. */
  unlockedAt: z.iso.datetime().nullable(),
  finale: z.object({
    isFinale: z.boolean(),
    /** The player's vote, everyone's (enough agreeing), or the rules. */
    source: z.enum(FINALE_SOURCES),
    byRule: z.boolean(),
    yourVote: z.boolean().nullable(),
  }),
});

export type GameAchievement = z.infer<typeof GameAchievementSchema>;

/** Response of GET /api/library/:id/achievements: unlocked first. */
export const GameAchievementsResponseSchema = z.object({
  achievements: z.array(GameAchievementSchema),
});

export type GameAchievementsResponse = z.infer<
  typeof GameAchievementsResponseSchema
>;

/** Body of PUT /api/library/:id/achievements/:achievementId/finale-vote. */
export const FinaleVoteRequestSchema = z.object({
  /** True or false to vote; null to take the vote back. */
  isFinale: z.boolean().nullable(),
});

export type FinaleVoteRequest = z.infer<typeof FinaleVoteRequestSchema>;
