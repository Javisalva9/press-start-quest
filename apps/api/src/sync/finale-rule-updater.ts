import { Injectable } from '@nestjs/common';
import { isFinaleAchievement } from '../catalog/finale-achievement.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Keeps achievements.finaleByRule in line with the phrase rules for the
 * games of a user's library. On every sync, not only on import: it also
 * covers achievements saved before the column existed, and any change to
 * the rules.
 */
@Injectable()
export class FinaleRuleUpdater {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns how many achievements changed. */
  async update(userId: string): Promise<number> {
    const achievements = await this.prisma.achievement.findMany({
      where: { game: { userGames: { some: { userId } } } },
      select: { id: true, name: true, description: true, finaleByRule: true },
    });

    const toTrue: string[] = [];
    const toFalse: string[] = [];
    for (const achievement of achievements) {
      const finale = isFinaleAchievement(achievement);
      if (finale !== achievement.finaleByRule) {
        (finale ? toTrue : toFalse).push(achievement.id);
      }
    }
    if (toTrue.length + toFalse.length === 0) {
      return 0;
    }
    await this.prisma.$transaction([
      this.prisma.achievement.updateMany({
        where: { id: { in: toTrue } },
        data: { finaleByRule: true },
      }),
      this.prisma.achievement.updateMany({
        where: { id: { in: toFalse } },
        data: { finaleByRule: false },
      }),
    ]);
    return toTrue.length + toFalse.length;
  }
}
