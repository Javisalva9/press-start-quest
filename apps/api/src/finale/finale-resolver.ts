import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { effectiveFinale, type FinaleSource } from './finale-vote.js';

export interface FinaleInfo {
  finale: boolean;
  source: FinaleSource;
  byRule: boolean;
  yourVote: boolean | null;
}

/**
 * Says which achievements mark the end of their game for a player, mixing
 * the phrase rules, their own votes and everyone's (see effectiveFinale).
 * Three small queries for any number of achievements.
 */
@Injectable()
export class FinaleResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    userId: string,
    achievementIds: string[],
  ): Promise<Map<string, FinaleInfo>> {
    const ids = [...new Set(achievementIds)];
    if (ids.length === 0) {
      return new Map();
    }
    const [achievements, mine, tally] = await Promise.all([
      this.prisma.achievement.findMany({
        where: { id: { in: ids } },
        select: { id: true, finaleByRule: true },
      }),
      this.prisma.achievementFinaleVote.findMany({
        where: { userId, achievementId: { in: ids } },
        select: { achievementId: true, isFinale: true },
      }),
      this.prisma.achievementFinaleVote.groupBy({
        by: ['achievementId', 'isFinale'],
        where: { achievementId: { in: ids } },
        _count: { _all: true },
      }),
    ]);
    const myVote = new Map(
      mine.map((vote) => [vote.achievementId, vote.isFinale]),
    );
    const counts = new Map<string, { votes: number; yes: number }>();
    for (const row of tally) {
      const count = counts.get(row.achievementId) ?? { votes: 0, yes: 0 };
      count.votes += row._count._all;
      if (row.isFinale) {
        count.yes += row._count._all;
      }
      counts.set(row.achievementId, count);
    }

    return new Map(
      achievements.map((achievement) => {
        const yourVote = myVote.get(achievement.id) ?? null;
        const { votes, yes } = counts.get(achievement.id) ?? {
          votes: 0,
          yes: 0,
        };
        return [
          achievement.id,
          {
            ...effectiveFinale({
              byRule: achievement.finaleByRule,
              yourVote,
              votes,
              yes,
            }),
            byRule: achievement.finaleByRule,
            yourVote,
          },
        ];
      }),
    );
  }

  /** The ids, of those given, that mark the end for this player. */
  async finales(
    userId: string,
    achievementIds: string[],
  ): Promise<Set<string>> {
    const resolved = await this.resolve(userId, achievementIds);
    return new Set(
      [...resolved].filter(([, info]) => info.finale).map(([id]) => id),
    );
  }
}
