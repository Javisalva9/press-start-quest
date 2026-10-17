import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApiError, FinaleVoteRequest, GameAchievement } from '@psq/shared';
import type { FinaleInfo } from '../finale/finale-resolver.js';
import { FinaleResolver } from '../finale/finale-resolver.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CompletionDetector } from '../sync/completion-detector.js';

/**
 * A game's achievements on its page, and the player's votes on which one
 * marks its end. A vote changes the completion signals at once: voting
 * "The Hollow Knight" as the ending makes Hollow Knight look finished.
 */
@Injectable()
export class AchievementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finales: FinaleResolver,
    private readonly completions: CompletionDetector,
  ) {}

  async list(userId: string, userGameId: string): Promise<GameAchievement[]> {
    const { gameId } = await this.entry(userId, userGameId);
    const achievements = await this.prisma.achievement.findMany({
      where: { gameId },
      select: {
        id: true,
        name: true,
        description: true,
        unlocks: { where: { userGameId }, select: { unlockedAt: true } },
      },
    });
    const finales = await this.finales.resolve(
      userId,
      achievements.map((achievement) => achievement.id),
    );
    return (
      achievements
        .map((achievement) =>
          toGameAchievement(
            achievement,
            achievement.unlocks[0]?.unlockedAt ?? null,
            finales.get(achievement.id),
          ),
        )
        // Unlocked first, the latest on top; then the rest by name.
        .sort(
          (a, b) =>
            (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? '') ||
            a.name.localeCompare(b.name),
        )
    );
  }

  async vote(
    userId: string,
    userGameId: string,
    achievementId: string,
    { isFinale }: FinaleVoteRequest,
  ): Promise<GameAchievement> {
    const { gameId } = await this.entry(userId, userGameId);
    const achievement = await this.prisma.achievement.findFirst({
      where: { id: achievementId, gameId },
      select: {
        id: true,
        name: true,
        description: true,
        unlocks: { where: { userGameId }, select: { unlockedAt: true } },
      },
    });
    if (!achievement) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ACHIEVEMENT_NOT_FOUND',
      } satisfies ApiError);
    }

    if (isFinale === null) {
      await this.prisma.achievementFinaleVote.deleteMany({
        where: { userId, achievementId },
      });
    } else {
      await this.prisma.achievementFinaleVote.upsert({
        where: { userId_achievementId: { userId, achievementId } },
        create: { userId, achievementId, isFinale },
        update: { isFinale },
      });
    }
    // The vote may change which games look finished: worked out now, not
    // at the next sync.
    await this.completions.update(userId);

    const finales = await this.finales.resolve(userId, [achievementId]);
    return toGameAchievement(
      achievement,
      achievement.unlocks[0]?.unlockedAt ?? null,
      finales.get(achievementId),
    );
  }

  /** The player's library entry, or 404 (another player's is "not found"). */
  private async entry(userId: string, userGameId: string) {
    const entry = await this.prisma.userGame.findFirst({
      where: { id: userGameId, userId },
      select: { gameId: true },
    });
    if (!entry) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'LIBRARY_GAME_NOT_FOUND',
      } satisfies ApiError);
    }
    return entry;
  }
}

function toGameAchievement(
  achievement: { id: string; name: string; description: string },
  unlockedAt: Date | null,
  finale: FinaleInfo | undefined,
): GameAchievement {
  return {
    id: achievement.id,
    name: achievement.name,
    description: achievement.description,
    unlockedAt: unlockedAt?.toISOString() ?? null,
    finale: {
      isFinale: finale?.finale ?? false,
      source: finale?.source ?? 'RULE',
      byRule: finale?.byRule ?? false,
      yourVote: finale?.yourVote ?? null,
    },
  };
}
