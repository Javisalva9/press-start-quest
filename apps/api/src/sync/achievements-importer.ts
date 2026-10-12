import { Injectable, Logger } from '@nestjs/common';
import PQueue from 'p-queue';
import { GameKind, Platform } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LibraryAchievement } from '../providers/library-provider.js';
import { SteamLibraryProvider } from '../providers/steam/steam-library.provider.js';

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

/**
 * Reads how many achievements the user unlocked in each game they played.
 * Needed in stage 2 to detect finished games.
 *
 * One request per game, so only for games that need it: played and never
 * read (achievementsTotal is null), or whose playtime changed in this sync.
 * A game without achievements is saved as 0 / 0, so it's not asked again.
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
        OR: [{ achievementsTotal: null }, { id: { in: touchedUserGameIds } }],
      },
      select: {
        id: true,
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
        this.queue.add(async () => {
          const steam = entry.ownerships[0];
          try {
            if (!steam) {
              return null;
            }
            const achievements = await this.steam.getAchievements(
              steam.source.externalId,
              steam.externalAppId,
            );
            return { id: entry.id, ...countAchievements(achievements) };
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
      await this.prisma.$transaction(
        read.map(({ id, ...counts }) =>
          this.prisma.userGame.update({ where: { id }, data: counts }),
        ),
      );
    }
    return { achievementsRead: read.length };
  }
}
