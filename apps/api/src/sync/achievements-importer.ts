import { Injectable, Logger } from '@nestjs/common';
import PQueue from 'p-queue';
import { chunk } from '../common/chunk.js';
import { GameKind, Platform } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LibraryAchievement } from '../providers/library-provider.js';
import { SteamLibraryProvider } from '../providers/steam/steam-library.provider.js';

/** Rows per INSERT: well below Postgres's limit of parameters per query. */
const ROWS_PER_INSERT = 1000;

/** Unlocked and total achievements; 0 / 0 for a game that has none. */
export function countAchievements(achievements: LibraryAchievement[] | null): {
  achievementsUnlocked: number;
  achievementsTotal: number;
} {
  return {
    achievementsUnlocked:
      achievements?.filter((achievement) => achievement.unlockedAt).length ?? 0,
    achievementsTotal: achievements?.length ?? 0,
  };
}

/** What was read for one game of the user's library. */
interface ReadGame {
  userGameId: string;
  gameId: string;
  /** Null if the game has no achievements. */
  achievements: LibraryAchievement[] | null;
}

/**
 * Reads the user's achievements in each game they played: how many, and
 * which ones. The finished-games detector needs the names, to spot a "finish
 * the game" achievement.
 *
 * One request per game, so only for games that need it: played and never
 * read (achievementsTotal is null), whose playtime changed in this sync, or
 * with unlocked achievements but no names saved. A game without
 * achievements is saved as 0 / 0, so it's not asked again.
 */
@Injectable()
export class AchievementsImporter {
  private readonly logger = new Logger(AchievementsImporter.name);
  /** The Steam Web API has no tight limit, but 4 at a time is polite. */
  private readonly queue = new PQueue({ concurrency: 4 });

  constructor(
    private readonly prisma: PrismaService,
    private readonly steam: SteamLibraryProvider,
  ) {}

  /** `onProgress` receives how much is done, from 0 to 1. */
  async importSteam(
    userId: string,
    touchedUserGameIds: string[],
    onProgress: (fraction: number) => Promise<void>,
  ): Promise<{ achievementsRead: number }> {
    const entries = await this.prisma.userGame.findMany({
      where: {
        userId,
        owned: true,
        playtimeMin: { gt: 0 },
        game: { kind: GameKind.GAME },
        OR: [
          { achievementsTotal: null },
          { id: { in: touchedUserGameIds } },
          // Counted but without names: read before names were saved (or
          // their rows were lost). Heals itself on the next sync.
          { achievementsUnlocked: { gt: 0 }, achievements: { none: {} } },
        ],
      },
      select: {
        id: true,
        gameId: true,
        ownerships: {
          where: { source: { platform: Platform.STEAM } },
          select: {
            externalAppId: true,
            source: { select: { externalId: true } },
          },
        },
      },
    });

    let done = 0;
    const results = await Promise.all(
      entries.map((entry) =>
        this.queue.add(async (): Promise<ReadGame | null> => {
          const steam = entry.ownerships[0];
          try {
            if (!steam) {
              return null;
            }
            const achievements = await this.steam.getAchievements(
              steam.source.externalId,
              steam.externalAppId,
            );
            return { userGameId: entry.id, gameId: entry.gameId, achievements };
          } catch (error) {
            // Left as it was; the next sync tries again.
            this.logger.warn(
              `Could not read achievements for appid ${steam?.externalAppId}: ${(error as Error).message}`,
            );
            return null;
          } finally {
            done += 1;
            await onProgress(done / entries.length);
          }
        }),
      ),
    );

    const read = results.filter((result) => result !== null);
    if (read.length > 0) {
      await this.save(read);
    }
    return { achievementsRead: read.length };
  }

  private async save(read: ReadGame[]): Promise<void> {
    // 1. The catalog: achievements no player had brought in yet. The ones
    //    already there are left as they are (skipDuplicates).
    const catalog = read.flatMap(({ gameId, achievements }) =>
      (achievements ?? []).map((achievement) => ({
        gameId,
        platform: Platform.STEAM,
        externalId: achievement.id,
        name: achievement.name,
        description: achievement.description,
      })),
    );
    for (const rows of chunk(catalog, ROWS_PER_INSERT)) {
      await this.prisma.achievement.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }

    // 2. Their ids, to link the unlocked ones to the user.
    const known = await this.prisma.achievement.findMany({
      where: {
        gameId: { in: [...new Set(read.map(({ gameId }) => gameId))] },
        platform: Platform.STEAM,
      },
      select: { id: true, gameId: true, externalId: true },
    });
    const idOf = new Map(
      known.map(({ id, gameId, externalId }) => [
        `${gameId}:${externalId}`,
        id,
      ]),
    );
    const unlocks = read.flatMap(({ userGameId, gameId, achievements }) =>
      (achievements ?? []).flatMap(({ id, unlockedAt }) => {
        const achievementId = idOf.get(`${gameId}:${id}`);
        return unlockedAt && achievementId
          ? [{ userGameId, achievementId, unlockedAt }]
          : [];
      }),
    );

    // 3. Counts and unlocks in one transaction: what each game read now
    //    replaces what it had, so they never disagree.
    const userGameIds = read.map(({ userGameId }) => userGameId);
    await this.prisma.$transaction([
      ...read.map(({ userGameId, achievements }) =>
        this.prisma.userGame.update({
          where: { id: userGameId },
          data: countAchievements(achievements),
        }),
      ),
      this.prisma.userAchievement.deleteMany({
        where: {
          userGameId: { in: userGameIds },
          achievement: { platform: Platform.STEAM },
        },
      }),
      ...chunk(unlocks, ROWS_PER_INSERT).map((rows) =>
        this.prisma.userAchievement.createMany({ data: rows }),
      ),
    ]);
  }
}
