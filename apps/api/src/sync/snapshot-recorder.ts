import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Keeps the playtime history. Steam only gives the running total, so after
 * each sync the total of every game that changed is saved for that day:
 * the difference between two photos is what was played in between. The
 * monthly chart and the streaks come from here.
 *
 * Reading it: a game's first photo on the player's first day of history
 * is a starting point, not a day of play (all the hours before the app
 * existed land there). A first photo on a later day is a game started
 * since: its hours count from 0.
 */
@Injectable()
export class SnapshotRecorder {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Saves today's photo of the games whose playtime changed, and the
   * starting point of any played game that has none. A second sync on the
   * same day overwrites that day's photo. Returns how many were written.
   */
  record(
    userId: string,
    changedUserGameIds: string[],
    day: string,
  ): Promise<number> {
    // One statement for every game: Prisma has no bulk upsert, Postgres
    // does (INSERT … ON CONFLICT). Values go as parameters, never pasted
    // into the SQL.
    return this.prisma.$executeRaw`
      INSERT INTO "playtime_snapshots" ("id", "userGameId", "date", "playtimeMin")
      SELECT gen_random_uuid()::text, ug."id", ${day}::date, ug."playtimeMin"
      FROM "user_games" ug
      WHERE ug."userId" = ${userId}
        AND ug."owned"
        AND ug."playtimeMin" > 0
        AND (
          ug."id" = ANY(${changedUserGameIds}::text[])
          OR NOT EXISTS (
            SELECT 1 FROM "playtime_snapshots" s WHERE s."userGameId" = ug."id"
          )
        )
      ON CONFLICT ("userGameId", "date")
      DO UPDATE SET "playtimeMin" = EXCLUDED."playtimeMin"
    `;
  }
}
