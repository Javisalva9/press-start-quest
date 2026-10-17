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
import { pausedLongEnough, STARTED_MIN } from '../catalog/auto-status.js';
import { FinaleResolver } from '../finale/finale-resolver.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** How strong each signal is: a card comes back only with a stronger one. */
const STRENGTH: Record<CompletionSignal, number> = {
  [CompletionSignal.PLAYTIME]: 1,
  [CompletionSignal.FINALE_ACHIEVEMENT]: 2,
  [CompletionSignal.ALL_ACHIEVEMENTS]: 3,
};

const strength = (signal: CompletionSignal | null) =>
  signal ? STRENGTH[signal] : 0;

/**
 * Without a signal, a game only gets "did you finish it?" when it's
 * completable, nobody knows how long it is, it's been played this long and
 * it isn't being played now. With a known length, below 80 % there's no
 * signal and no card: fewer false alarms, at the price of a few games
 * finished early (Hades at 66 %), which the player marks by hand.
 */
export const UNKNOWN_LENGTH_MIN = 5 * 60;

/** What a card needs, and what decides whether it shows. */
const cardSelect = {
  id: true,
  status: true,
  playtimeMin: true,
  lastPlayedAt: true,
  achievementsUnlocked: true,
  achievementsTotal: true,
  completionSignal: true,
  completionConfidence: true,
  reviewedAt: true,
  reviewedSignal: true,
  typeOverride: true,
  game: {
    select: {
      title: true,
      coverUrl: true,
      heroUrl: true,
      ttbMainMin: true,
      gameType: true,
    },
  },
  // Every unlocked one: rules and votes decide which is the finale shown.
  achievements: {
    select: {
      achievementId: true,
      achievement: { select: { name: true, description: true } },
    },
  },
} satisfies Prisma.UserGameSelect;

type CardRow = Prisma.UserGameGetPayload<{ select: typeof cardSelect }>;

/**
 * The confirmation queue. Two kinds of cards, "did you finish it?" first:
 *
 * - Finished: games that look finished (a completion signal), plus
 *   completable games of unknown length played for 5 hours and not
 *   being played now. Back after a "no" only with a
 *   stronger signal.
 * - Abandoned: games the app put on hold, unplayed for 3 months, that the
 *   player hasn't answered about since their last session. Any earlier
 *   card already offered "I dropped it", so after an answer it only comes
 *   back if they play again and pause again.
 *
 * The player answers with a swipe, and each answer takes the card out.
 */
@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finales: FinaleResolver,
  ) {}

  async queue(
    userId: string,
    limit: number,
    now = new Date(),
  ): Promise<ReviewQueue> {
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
          // A reason to ask: a signal, or having really started it. Under
          // an hour it was only tried (the same line as the automatic
          // "backlog"): asking "did you finish it?" makes no sense.
          {
            OR: [
              { completionSignal: { not: null } },
              { playtimeMin: { gte: STARTED_MIN } },
            ],
          },
        ],
      },
      select: cardSelect,
    });

    // "Stronger than the one answered" compares enum values, which Prisma
    // can't filter by order, and the dates compare two columns: done here,
    // on the few rows left.
    const finished = rows
      .filter(worthAsking)
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
    const asked = new Set(finished.map((row) => row.id));
    const abandoned = rows
      .filter(
        (row) =>
          !asked.has(row.id) &&
          row.status === GameStatus.ON_HOLD &&
          pausedLongEnough(row.lastPlayedAt, now) &&
          // Not answered since the last session. With no date, any answer
          // is final: there's no "playing again" to notice.
          (row.reviewedAt === null ||
            (row.lastPlayedAt !== null && row.reviewedAt < row.lastPlayedAt)),
      )
      // Paused the longest first.
      .sort(
        (a, b) =>
          (a.lastPlayedAt?.getTime() ?? 0) - (b.lastPlayedAt?.getTime() ?? 0),
      );

    const page = [
      ...finished.map((row) => [row, 'finished'] as const),
      ...abandoned.map((row) => [row, 'abandoned'] as const),
    ];
    const shown = page.slice(0, limit);
    // The finale achievement behind a FINALE_ACHIEVEMENT card: only for
    // the cards on this page that need it.
    const finales = await this.finales.finales(
      userId,
      shown.flatMap(([row]) =>
        row.completionSignal === CompletionSignal.FINALE_ACHIEVEMENT
          ? row.achievements.map(({ achievementId }) => achievementId)
          : [],
      ),
    );
    return {
      items: shown.map(([row, question]) =>
        toReviewCard(row, question, finales),
      ),
      total: page.length,
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

/** A reason to ask "did you finish it?": a signal, or see UNKNOWN_LENGTH_MIN. */
function worthAsking(row: CardRow): boolean {
  if (row.completionSignal !== null) {
    return true;
  }
  const type = row.typeOverride ?? row.game.gameType;
  return (
    type === GameType.COMPLETABLE &&
    row.game.ttbMainMin === null &&
    row.playtimeMin >= UNKNOWN_LENGTH_MIN &&
    row.status !== GameStatus.PLAYING
  );
}

/** Statuses only an answer sets: "not finished" undoes them. */
function isAnswerStatus(status: GameStatus): boolean {
  return (
    status === GameStatus.COMPLETED ||
    status === GameStatus.ABANDONED ||
    status === GameStatus.DISCARDED
  );
}

function toReviewCard(
  row: CardRow,
  question: ReviewCard['question'],
  finales: ReadonlySet<string>,
): ReviewCard {
  const finale =
    row.achievements.find(({ achievementId }) => finales.has(achievementId))
      ?.achievement ?? null;
  return {
    id: row.id,
    question,
    title: row.game.title,
    coverUrl: row.game.coverUrl,
    heroUrl: row.game.heroUrl,
    playtimeMinutes: row.playtimeMin,
    lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
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
