import { Injectable, Logger } from '@nestjs/common';
import { autoStatus } from '../catalog/auto-status.js';
import {
  GameKind,
  type GameStatus,
  StatusSource,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Moves owned games between backlog, playing and on hold, from playtime
 * and the last session. Only games whose status the player hasn't set.
 */
@Injectable()
export class AutoStatusUpdater {
  private readonly logger = new Logger(AutoStatusUpdater.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Returns how many games changed status. */
  async update(userId: string, now = new Date()): Promise<number> {
    const entries = await this.prisma.userGame.findMany({
      where: {
        userId,
        owned: true,
        statusSource: StatusSource.AUTO,
        game: { kind: GameKind.GAME },
      },
      select: {
        id: true,
        status: true,
        playtimeMin: true,
        lastPlayedAt: true,
        typeOverride: true,
        game: { select: { gameType: true } },
      },
    });

    // Grouped by new status: one UPDATE per status instead of one per game.
    const changes = new Map<GameStatus, string[]>();
    for (const entry of entries) {
      const status = autoStatus(
        {
          playtimeMin: entry.playtimeMin,
          lastPlayedAt: entry.lastPlayedAt,
          gameType: entry.typeOverride ?? entry.game.gameType,
        },
        now,
      );
      if (status !== entry.status) {
        changes.set(status, [...(changes.get(status) ?? []), entry.id]);
      }
    }
    if (changes.size === 0) {
      return 0;
    }

    await this.prisma.$transaction(
      [...changes].map(([status, ids]) =>
        this.prisma.userGame.updateMany({
          where: { id: { in: ids } },
          data: { status },
        }),
      ),
    );
    const changed = [...changes.values()].reduce((n, ids) => n + ids.length, 0);
    this.logger.log(
      `${changed} status(es) changed: ${[...changes]
        .map(([status, ids]) => `${ids.length} ${status}`)
        .join(', ')}`,
    );
    return changed;
  }
}
