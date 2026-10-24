import { Injectable } from '@nestjs/common';
import type { StatsOverview, StatsTimeline } from '@psq/shared';
import { GameKind, GameStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { gamingDay } from '../sync/gaming-day.js';
import { streaks, summarizeProgress } from './progress.js';
import { backlogPace, monthlyTimeline, type PlayedDay } from './timeline.js';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(userId: string, now = new Date()): Promise<StatsOverview> {
    const [entries, history] = await Promise.all([
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
      this.playedDays(userId),
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
    const today = gamingDay(now);
    return {
      ...counts,
      streak: {
        ...streaks(
          history.days.map(({ day }) => day),
          today,
        ),
        since: history.since,
      },
      pace: backlogPace(
        history.days,
        history.since,
        today,
        counts.remainingMinutes,
      ),
    };
  }

  /** Completed games and hours played per month, for the chart. */
  async timeline(userId: string, now = new Date()): Promise<StatsTimeline> {
    const [history, completed] = await Promise.all([
      this.playedDays(userId),
      this.prisma.userGame.findMany({
        where: {
          userId,
          owned: true,
          status: GameStatus.COMPLETED,
          completedAt: { not: null },
          game: { kind: GameKind.GAME },
        },
        select: { completedAt: true },
      }),
    ]);
    return {
      months: monthlyTimeline(
        history.days,
        completed.map(({ completedAt }) => gamingDay(completedAt!)),
        gamingDay(now),
      ),
    };
  }

  /**
   * Minutes played per gaming day, from the playtime photos: what each
   * game has more than in its previous photo (LAG looks at that previous
   * row, game by game). A game's first photo counts too, unless it's on
   * the first day of history: that one is the starting point, with all
   * the hours from before the app. A first photo can carry hours from
   * elsewhere (a game just imported with them), so a game adds at most a
   * whole day to a day.
   */
  private async playedDays(
    userId: string,
  ): Promise<{ days: PlayedDay[]; since: string | null }> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        day: string;
        minutes: number;
        backlogMinutes: number;
        since: string;
      }>
    >`
      WITH photos AS (
        SELECT
          s."date",
          s."playtimeMin",
          LAG(s."playtimeMin") OVER (
            PARTITION BY s."userGameId" ORDER BY s."date"
          ) AS previous,
          COALESCE(ug."typeOverride", g."gameType") = 'ENDLESS' AS endless
        FROM "playtime_snapshots" s
        JOIN "user_games" ug ON ug."id" = s."userGameId"
        JOIN "games" g ON g."id" = ug."gameId"
        WHERE ug."userId" = ${userId}
      ),
      history AS (SELECT MIN("date") AS since FROM photos),
      played AS (
        SELECT
          p."date",
          LEAST(p."playtimeMin" - COALESCE(p.previous, 0), 1440) AS minutes,
          p.endless
        FROM photos p CROSS JOIN history h
        WHERE (p.previous IS NOT NULL AND p."playtimeMin" > p.previous)
           OR (p.previous IS NULL AND p."date" > h.since AND p."playtimeMin" > 0)
      )
      SELECT
        to_char(p."date", 'YYYY-MM-DD') AS day,
        SUM(p.minutes)::int AS minutes,
        COALESCE(SUM(p.minutes) FILTER (WHERE NOT p.endless), 0)::int
          AS "backlogMinutes",
        to_char(h.since, 'YYYY-MM-DD') AS since
      FROM played p CROSS JOIN history h
      GROUP BY p."date", h.since
      ORDER BY p."date"
    `;
    if (rows.length > 0) {
      return {
        days: rows.map(({ day, minutes, backlogMinutes }) => ({
          day,
          minutes,
          backlogMinutes,
        })),
        since: rows[0]!.since,
      };
    }
    // No day played yet: history may still have started.
    const first = await this.prisma.$queryRaw<Array<{ since: string | null }>>`
      SELECT to_char(MIN(s."date"), 'YYYY-MM-DD') AS since
      FROM "playtime_snapshots" s
      JOIN "user_games" ug ON ug."id" = s."userGameId"
      WHERE ug."userId" = ${userId}
    `;
    return { days: [], since: first[0]?.since ?? null };
  }
}
