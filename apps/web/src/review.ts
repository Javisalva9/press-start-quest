import type { ReviewAnswerRequest, ReviewCard } from '@psq/shared';

export type ReviewAnswer = ReviewAnswerRequest['answer'];

export type SwipeDirection = 'right' | 'left' | 'down' | 'up';

/** In button order too: yes, no, dropped it, won't play. */
export const DIRECTIONS: readonly SwipeDirection[] = [
  'right',
  'left',
  'down',
  'up',
];

/** Same order as the plan: right yes, left no, down dropped, up won't play. */
export const ANSWER_BY_DIRECTION: Record<SwipeDirection, ReviewAnswer> = {
  right: 'finished',
  left: 'notFinished',
  down: 'abandoned',
  up: 'wontPlay',
};

/** Arrow keys answer too, on a computer. */
export const DIRECTION_BY_KEY: Record<string, SwipeDirection> = {
  ArrowRight: 'right',
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowUp: 'up',
};

/**
 * Where a drag points, by its longest axis, once it's gone far enough.
 * A diagonal drag counts for the axis it moved most along.
 */
export function swipeDirection(
  dx: number,
  dy: number,
  threshold: number,
): SwipeDirection | null {
  const x = Math.abs(dx);
  const y = Math.abs(dy);
  if (Math.max(x, y) < threshold) {
    return null;
  }
  if (x >= y) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

/** Whole months since an ISO date (at least 1). */
export function monthsSince(isoDate: string, now: Date): number {
  const days = (now.getTime() - new Date(isoDate).getTime()) / 86_400_000;
  return Math.max(1, Math.floor(days / 30.44));
}

export type ReasonKey =
  | 'review.reason.allAchievements'
  | 'review.reason.finale'
  | 'review.reason.finaleHidden'
  | 'review.reason.playtime'
  | 'review.reason.played'
  | 'review.reason.paused'
  | 'review.reason.pausedLongAgo';

/**
 * The line under the question that says why we ask: the evidence we have.
 * `hours` formats minutes in the user's language.
 */
export function reasonFor(
  card: ReviewCard,
  now: Date,
  hours: (minutes: number) => string,
): { key: ReasonKey; values: Record<string, string | number> } {
  const played = hours(card.playtimeMinutes);

  if (card.question === 'abandoned') {
    return card.lastPlayedAt
      ? {
          key: 'review.reason.paused',
          values: { count: monthsSince(card.lastPlayedAt, now), played },
        }
      : { key: 'review.reason.pausedLongAgo', values: { played } };
  }

  if (card.signal === 'ALL_ACHIEVEMENTS' && card.achievements) {
    return {
      key: 'review.reason.allAchievements',
      values: { total: card.achievements.total },
    };
  }
  if (card.signal === 'FINALE_ACHIEVEMENT' && card.finaleAchievement) {
    const { name, description } = card.finaleAchievement;
    return description
      ? { key: 'review.reason.finale', values: { name, description } }
      : { key: 'review.reason.finaleHidden', values: { name } };
  }
  if (card.signal === 'PLAYTIME' && card.mainStoryMinutes) {
    return {
      key: 'review.reason.playtime',
      values: { played, story: hours(card.mainStoryMinutes) },
    };
  }
  return { key: 'review.reason.played', values: { played } };
}
