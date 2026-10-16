import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApiError,
  ReviewAnswerRequest,
  ReviewCard,
  ReviewQueue,
} from '@psq/shared';
import {
  CompletionSignal,
  GameKind,
  GameStatus,
  GameType,
  StatusSource,
  type Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** How strong each signal is: a card comes back only with a stronger one. */
const STRENGTH: Record<CompletionSignal, number> = {
  [CompletionSignal.PLAYTIME]: 1,
  [CompletionSignal.FINALE_ACHIEVEMENT]: 2,
  [CompletionSignal.ALL_ACHIEVEMENTS]: 3,
};

const strength = (signal: CompletionSignal | null) =>
  signal ? STRENGTH[signal] : 0;

/** What a card needs, and what decides whether it shows. */
const cardSelect = {
  id: true,
  playtimeMin: true,
  achievementsUnlocked: true,
  achievementsTotal: true,
  completionSignal: true,
  completionConfidence: true,
  reviewedAt: true,
  reviewedSignal: true,
  game: {
    select: { title: true, coverUrl: true, heroUrl: true, ttbMainMin: true },
  },
  achievements: {
    where: { achievement: { finaleByRule: true } },
    select: { achievement: { select: { name: true, description: true } } },
    take: 1,
  },
} satisfies Prisma.UserGameSelect;

type CardRow = Prisma.UserGameGetPayload<{ select: typeof cardSelect }>;

/**
 * The confirmation queue: games that look finished, plus, on the first
 * load, every played one (the initial triage). The player answers with a
 * swipe, and each answer takes the game out of the queue.
 */
@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async queue(userId: string, limit: number): Promise<ReviewQueue> {
    const rows = await this.prisma.userGame.findMany({
      where: {
        userId,
        owned: true,
        // A status the player set is already an answer.
        statusSource: StatusSource.AUTO,
        game: { kind: GameKind.GAME },
        // Endless games have nothing to finish: the player's type first.
        AND: [
          {
            OR: [
              { typeOverride: { notIn: [GameType.ENDLESS] } },
              {
                typeOverride: null,
                game: { gameType: { not: GameType.ENDLESS } },
              },
            ],
          },
          // A reason to ask: a signal, or having played it at all.
          {
            OR: [
              { completionSignal: { not: null } },
              { playtimeMin: { gt: 0 } },
            ],
          },
        ],
      },
      select: cardSelect,
    });

    // "Stronger than the one answered" compares enum values, which Prisma
    // can't filter by order: done here, on the few rows left.
    const waiting = rows
      .filter(
        (row) =>
          row.reviewedAt === null ||
          strength(row.completionSignal) > strength(row.reviewedSignal),
      )
      // Most likely finished first, then most played.
      .sort(
        (a, b) =>
          (b.completionConfidence ?? 0) - (a.completionConfidence ?? 0) ||
          b.playtimeMin - a.playtimeMin,
      );

    return {
      items: waiting.slice(0, limit).map(toReviewCard),
      total: waiting.length,
    };
  }

  /**
   * Saves an answer. "Finished", "abandoned" and "won't play" are the
   * player's own status from now on. "Not finished" isn't a status: it
   * only records which signal was turned down, so the app can still move
   * the game to "playing" by itself, and asks again if a stronger signal
   * turns up.
   */
  async answer(
    userId: string,
    id: string,
    { answer }: ReviewAnswerRequest,
  ): Promise<void> {
    const entry = await this.prisma.userGame.findFirst({
      where: { id, userId },
      select: { status: true, completionSignal: true },
    });
    if (!entry) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'LIBRARY_GAME_NOT_FOUND',
      } satisfies ApiError);
    }

    const now = new Date();
    const reviewed = {
      reviewedAt: now,
      reviewedSignal: entry.completionSignal,
    };
    const manual = (status: GameStatus) => ({
      ...reviewed,
      status,
      statusSource: StatusSource.MANUAL,
      completedAt: status === GameStatus.COMPLETED ? now : null,
    });

    const data: Prisma.UserGameUpdateInput =
      answer === 'finished'
        ? manual(GameStatus.COMPLETED)
        : answer === 'abandoned'
          ? manual(GameStatus.ABANDONED)
          : answer === 'wontPlay'
            ? manual(GameStatus.DISCARDED)
            : {
                ...reviewed,
                // Undoing an earlier answer: back to the automatic status.
                statusSource: StatusSource.AUTO,
                completedAt: null,
                ...(isAnswerStatus(entry.status)
                  ? { status: GameStatus.BACKLOG }
                  : {}),
              };
    await this.prisma.userGame.update({ where: { id }, data });
  }
}

/** Statuses only an answer sets: "not finished" undoes them. */
function isAnswerStatus(status: GameStatus): boolean {
  return (
    status === GameStatus.COMPLETED ||
    status === GameStatus.ABANDONED ||
    status === GameStatus.DISCARDED
  );
}

function toReviewCard(row: CardRow): ReviewCard {
  const finale = row.achievements[0]?.achievement ?? null;
  return {
    id: row.id,
    title: row.game.title,
    coverUrl: row.game.coverUrl,
    heroUrl: row.game.heroUrl,
    playtimeMinutes: row.playtimeMin,
    mainStoryMinutes: row.game.ttbMainMin,
    achievements:
      row.achievementsTotal !== null && row.achievementsTotal > 0
        ? {
            unlocked: row.achievementsUnlocked ?? 0,
            total: row.achievementsTotal,
          }
        : null,
    signal: row.completionSignal,
    confidence: row.completionConfidence,
    // Only when it's the reason shown on the card.
    finaleAchievement:
      row.completionSignal === CompletionSignal.FINALE_ACHIEVEMENT
        ? finale
        : null,
  };
}
