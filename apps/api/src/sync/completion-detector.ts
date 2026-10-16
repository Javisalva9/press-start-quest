import { Injectable, Logger } from '@nestjs/common';
import { detectCompletion } from '../catalog/completion.js';
import {
  type CompletionSignal,
  GameKind,
  StatusSource,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Marks the games of a user's library that look finished: what the
 * confirmation queue will show. It only fills completionConfidence and
 * completionSignal; the status changes when the player confirms.
 *
 * Games with a status the player set (statusSource MANUAL) are never
 * touched: their word is final, including a "no, I haven't finished it".
 */
@Injectable()
export class CompletionDetector {
  private readonly logger = new Logger(CompletionDetector.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Returns how many games changed. */
  async update(userId: string): Promise<number> {
    const entries = await this.prisma.userGame.findMany({
      where: {
        userId,
        owned: true,
        statusSource: StatusSource.AUTO,
        game: { kind: GameKind.GAME },
      },
      select: {
        id: true,
        playtimeMin: true,
        achievementsUnlocked: true,
        achievementsTotal: true,
        typeOverride: true,
        completionSignal: true,
        completionConfidence: true,
        game: { select: { gameType: true, ttbMainMin: true } },
        // One unlocked finale achievement is enough.
        achievements: {
          where: { achievement: { finaleByRule: true } },
          select: { achievementId: true },
          take: 1,
        },
      },
    });

    // Grouped by result: one UPDATE per signal instead of one per game.
    const changes = new Map<string, string[]>();
    let changed = 0;
    for (const entry of entries) {
      const result = detectCompletion({
        gameType: entry.typeOverride ?? entry.game.gameType,
        playtimeMin: entry.playtimeMin,
        ttbMainMin: entry.game.ttbMainMin,
        achievementsUnlocked: entry.achievementsUnlocked,
        achievementsTotal: entry.achievementsTotal,
        finaleUnlocked: entry.achievements.length > 0,
      });
      const signal = result?.signal ?? null;
      const confidence = result?.confidence ?? null;
      if (
        signal !== entry.completionSignal ||
        confidence !== entry.completionConfidence
      ) {
        const key = JSON.stringify([signal, confidence]);
        changes.set(key, [...(changes.get(key) ?? []), entry.id]);
        changed += 1;
      }
    }
    if (changed === 0) {
      return 0;
    }

    await this.prisma.$transaction(
      [...changes].map(([key, ids]) => {
        const [signal, confidence] = JSON.parse(key) as [
          CompletionSignal | null,
          number | null,
        ];
        return this.prisma.userGame.updateMany({
          where: { id: { in: ids } },
          data: { completionSignal: signal, completionConfidence: confidence },
        });
      }),
    );
    this.logger.log(`${changed} game(s) changed completion signal`);
    return changed;
  }
}
