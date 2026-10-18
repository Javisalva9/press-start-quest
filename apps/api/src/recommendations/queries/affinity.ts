import type { PrismaService } from '../../prisma/prisma.service.js';
import { TASTE_TAG_KINDS } from '../../taste/taste-weight.js';

export interface AffinityRow {
  gameId: string;
  /** Sum of the player's scores for the game's tags, over √(tags). */
  raw: number;
  /** The tag that fits the most (a genre or theme when there's one). */
  topTag: string | null;
  topKind: 'GENRE' | 'THEME' | 'MODE' | 'PERSPECTIVE' | null;
}

/**
 * How well each game fits the player's taste, from taste_scores.
 *
 * Divided by √(number of tags), not by the number: a game with many tags
 * isn't rewarded just for having them, nor punished for being specific.
 * The result is only meaningful compared with the other candidates, which
 * is what the service does with it.
 *
 * The top tag is the reason shown on the card: a genre or theme says more
 * ("RPG", "Horror") than a mode or a camera, so those go first.
 */
export function affinityByGame(
  prisma: PrismaService,
  userId: string,
  gameIds: string[],
): Promise<AffinityRow[]> {
  const kinds = [...TASTE_TAG_KINDS];
  return prisma.$queryRaw<AffinityRow[]>`
    SELECT
      gt."gameId",
      COALESCE(SUM(ts."score"), 0) / SQRT(COUNT(*)) AS "raw",
      (ARRAY_AGG(t."name" ORDER BY t."kind" IN ('GENRE', 'THEME') DESC, ts."score" DESC)
        FILTER (WHERE ts."score" > 0))[1] AS "topTag",
      (ARRAY_AGG(t."kind"::text ORDER BY t."kind" IN ('GENRE', 'THEME') DESC, ts."score" DESC)
        FILTER (WHERE ts."score" > 0))[1] AS "topKind"
    FROM "game_tags" gt
    JOIN "tags" t ON t."id" = gt."tagId"
    LEFT JOIN "taste_scores" ts
      ON ts."tagId" = gt."tagId" AND ts."userId" = ${userId}
    WHERE gt."gameId" = ANY(${gameIds}::text[])
      AND t."kind" = ANY(${kinds}::"TagKind"[])
    GROUP BY gt."gameId"
  `;
}
