import { Injectable } from '@nestjs/common';
import type { StatsOverview } from '@psq/shared';
import { GameKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { gamingDay } from '../sync/gaming-day.js';
import { streaks, summarizeProgress } from './progress.js';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(userId: string, now = new Date()): Promise<StatsOverview> {
    const [entries, days] = await Promise.all([
      this.prisma.userGame.findMany({
        where: { userId, owned: true, game: { kind: GameKind.GAME } },
        select: {
          status: true,
          playtimeMin: true,
          typeOverride: true,
          serverOverride: true,
          game: {
            select: { gameType: true, serverStatus: true, ttbMainMin: true },
          },
        },
      }),
      this.daysPlayed(userId),
    ]);

    const counts = summarizeProgress(
      entries.map((entry) => ({
        status: entry.status,
        gameType: entry.typeOverride ?? entry.game.gameType,
        serverStatus: entry.serverOverride ?? entry.game.serverStatus,
        playtimeMin: entry.playtimeMin,
        ttbMainMin: entry.game.ttbMainMin,
      })),
    );
    return {
      ...counts,
      streak: {
        ...streaks(days.played, gamingDay(now)),
        since: days.since,
      },
    };
  }

  /**
   * The gaming days with play, from the playtime photos. A day counts if
   * some game has more minutes than in its previous photo (LAG looks at
   * that previous row, game by game). A game's first photo counts too,
   * unless it's on the first day of history: that one is the starting
   * point with all the hours from before the app.
   */
  private async daysPlayed(
    userId: string,
  ): Promise<{ played: string[]; since: string | null }> {
    const rows = await this.prisma.$queryRaw<
      Array<{ day: string; since: string }>
    >`
      WITH photos AS (
        SELECT
          s."date",
          s."playtimeMin",
          LAG(s."playtimeMin") OVER (
            PARTITION BY s."userGameId" ORDER BY s."date"
          ) AS previous
        FROM "playtime_snapshots" s
        JOIN "user_games" ug ON ug."id" = s."userGameId"
        WHERE ug."userId" = ${userId}
      ),
      history AS (SELECT MIN("date") AS since FROM photos)
      SELECT DISTINCT
        to_char(p."date", 'YYYY-MM-DD') AS day,
        to_char(h.since, 'YYYY-MM-DD') AS since
      FROM photos p CROSS JOIN history h
      WHERE (p.previous IS NOT NULL AND p."playtimeMin" > p.previous)
         OR (p.previous IS NULL AND p."date" > h.since)
    `;
    if (rows.length > 0) {
      return { played: rows.map((row) => row.day), since: rows[0]!.since };
    }
    // No day played yet: history may still have started.
    const first = await this.prisma.$queryRaw<Array<{ since: string | null }>>`
      SELECT to_char(MIN(s."date"), 'YYYY-MM-DD') AS since
      FROM "playtime_snapshots" s
      JOIN "user_games" ug ON ug."id" = s."userGameId"
      WHERE ug."userId" = ${userId}
    `;
    return { played: [], since: first[0]?.since ?? null };
  }
}
