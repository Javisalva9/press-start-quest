import { Injectable, Logger } from '@nestjs/common';
import {
  loadServerStatusSeed,
  serverStatusOn,
  type ServerStatusEntry,
} from '../catalog/server-status.js';
import { GameKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Applies the closed-servers list (data/server-status.json) to the games
 * of a user's library. It runs on every sync instead of as a one-off
 * database seed: a game enters the catalog the first time someone imports
 * it, which can be long after a seed would have run.
 *
 * Only the listed games are touched. The status is the catalog's; a
 * player's own mark (user_games.serverOverride) always wins.
 */
@Injectable()
export class ServerStatusUpdater {
  private readonly logger = new Logger(ServerStatusUpdater.name);
  /** Read once per process: the file only changes with a deploy. */
  private readonly seed = new Map<number, ServerStatusEntry>(
    loadServerStatusSeed().map((entry) => [entry.steamAppId, entry]),
  );

  constructor(private readonly prisma: PrismaService) {}

  /** Returns how many games changed status. */
  async update(userId: string, today = new Date()): Promise<number> {
    const games = await this.prisma.game.findMany({
      where: {
        kind: GameKind.GAME,
        steamAppId: { in: [...this.seed.keys()] },
        userGames: { some: { userId } },
      },
      select: {
        id: true,
        title: true,
        steamAppId: true,
        serverStatus: true,
        serverClosedAt: true,
      },
    });

    const changes = games.flatMap((game) => {
      const { status, closedAt } = serverStatusOn(
        this.seed.get(game.steamAppId!)!,
        today,
      );
      const changed =
        status !== game.serverStatus ||
        closedAt.getTime() !== game.serverClosedAt?.getTime();
      return changed ? [{ game, status, closedAt }] : [];
    });
    if (changes.length === 0) {
      return 0;
    }

    await this.prisma.$transaction(
      changes.map(({ game, status, closedAt }) =>
        this.prisma.game.update({
          where: { id: game.id },
          data: { serverStatus: status, serverClosedAt: closedAt },
        }),
      ),
    );
    this.logger.log(
      `Server status: ${changes
        .map(({ game, status }) => `${game.title} → ${status}`)
        .join(', ')}`,
    );
    return changes.length;
  }
}
