import { Injectable, Logger } from '@nestjs/common';
import type { TasteProfile, TasteTag } from '@psq/shared';
import { GameKind, TagKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fromHalfStars } from '../common/stars.js';
import { TASTE_TAG_KINDS, tasteWeight } from './taste-weight.js';

/**
 * The player's taste: a score per genre, theme, mode and perspective,
 * saved in taste_scores so a recommendation doesn't have to work it out
 * on every request.
 *
 * A tag's score is the sum of the weights of the games that have it (see
 * tasteWeight), times how rare it is in the player's library (its IDF,
 * ln(games with tags / games with this tag)). "Single player", in almost
 * every game, ends up near 0; "Horror", in 5 of 60, counts five times more
 * per game. What sets the player apart is what's left.
 */
@Injectable()
export class TasteProfileService {
  private readonly logger = new Logger(TasteProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Works the profile out again from the library. It's derived data: if it
   * fails, the error is logged and the caller goes on, and the next sync
   * tries again. Returns how many tags it saved, or null if it failed.
   */
  async refresh(userId: string): Promise<number | null> {
    try {
      const entries = await this.prisma.userGame.findMany({
        where: {
          userId,
          owned: true,
          hidden: false,
          game: { kind: GameKind.GAME },
        },
        select: {
          gameId: true,
          status: true,
          playtimeMin: true,
          personalRating: true,
        },
      });
      // The rule lives in TypeScript, where it's tested; adding it up over
      // every tag is a job for SQL.
      const played = entries
        .map((entry) => ({
          gameId: entry.gameId,
          weight: tasteWeight({
            status: entry.status,
            playtimeMin: entry.playtimeMin,
            stars:
              entry.personalRating === null
                ? null
                : fromHalfStars(entry.personalRating),
          }),
        }))
        .filter(({ weight }) => weight !== 0);
      const gameIds = played.map(({ gameId }) => gameId);
      const weights = played.map(({ weight }) => weight);
      const kinds = [...TASTE_TAG_KINDS];

      const [, saved] = await this.prisma.$transaction([
        this.prisma.tasteScore.deleteMany({ where: { userId } }),
        // unnest() turns the two arrays into rows (game, weight). Values go
        // as parameters, never pasted into the SQL. ON CONFLICT covers two
        // refreshes at once (a sync and a tap in the Repaso): the last wins.
        this.prisma.$executeRaw`
          WITH played AS (
            SELECT p."gameId", p."weight"
            FROM unnest(${gameIds}::text[], ${weights}::float8[])
              AS p("gameId", "weight")
          ),
          library_tags AS (
            SELECT gt."gameId", gt."tagId"
            FROM "user_games" ug
            JOIN "games" g ON g."id" = ug."gameId"
            JOIN "game_tags" gt ON gt."gameId" = ug."gameId"
            JOIN "tags" t ON t."id" = gt."tagId"
            WHERE ug."userId" = ${userId}
              AND ug."owned"
              AND NOT ug."hidden"
              AND g."kind" = 'GAME'
              AND t."kind" = ANY(${kinds}::"TagKind"[])
          ),
          rarity AS (
            SELECT
              "tagId",
              LN(
                (SELECT COUNT(DISTINCT "gameId") FROM library_tags)::float8
                / COUNT(*)
              ) AS "idf"
            FROM library_tags
            GROUP BY "tagId"
          )
          INSERT INTO "taste_scores" ("userId", "tagId", "score", "updatedAt")
          SELECT
            ${userId},
            lt."tagId",
            SUM(p."weight") * r."idf",
            -- Prisma keeps every timestamp in UTC.
            NOW() AT TIME ZONE 'UTC'
          FROM played p
          JOIN library_tags lt ON lt."gameId" = p."gameId"
          JOIN rarity r ON r."tagId" = lt."tagId"
          GROUP BY lt."tagId", r."idf"
          -- A tag in every game has an IDF of 0: it says nothing.
          HAVING SUM(p."weight") * r."idf" <> 0
          ON CONFLICT ("userId", "tagId")
          DO UPDATE SET "score" = EXCLUDED."score", "updatedAt" = EXCLUDED."updatedAt"
        `,
      ]);
      return saved;
    } catch (error) {
      this.logger.warn(
        `Could not update the taste profile of user ${userId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /** The profile as saved, favourites first, by kind of tag. */
  async profile(userId: string): Promise<TasteProfile> {
    const rows = await this.prisma.tasteScore.findMany({
      where: { userId },
      select: {
        score: true,
        updatedAt: true,
        tag: { select: { name: true, kind: true } },
      },
      orderBy: [{ score: 'desc' }, { tag: { name: 'asc' } }],
    });
    const ofKind = (kind: TagKind): TasteTag[] =>
      rows
        .filter((row) => row.tag.kind === kind)
        .map((row) => ({
          name: row.tag.name,
          score: Math.round(row.score * 100) / 100,
        }));
    const updatedAt = rows.reduce<Date | null>(
      (latest, row) =>
        latest && latest >= row.updatedAt ? latest : row.updatedAt,
      null,
    );
    return {
      updatedAt: updatedAt?.toISOString() ?? null,
      genres: ofKind(TagKind.GENRE),
      themes: ofKind(TagKind.THEME),
      modes: ofKind(TagKind.MODE),
      perspectives: ofKind(TagKind.PERSPECTIVE),
    };
  }
}
