import type { ReviewCard } from '@psq/shared';
import { describe, expect, it } from 'vitest';
import {
  ANSWER_BY_DIRECTION,
  monthsSince,
  reasonFor,
  swipeDirection,
} from './review';

const now = new Date('2026-10-16T12:00:00Z');
const hours = (minutes: number) => `${minutes / 60} h`;

const card = (overrides: Partial<ReviewCard> = {}): ReviewCard => ({
  id: 'ug1',
  question: 'finished',
  title: 'Moonlighter',
  coverUrl: null,
  heroUrl: null,
  playtimeMinutes: 600,
  lastPlayedAt: null,
  mainStoryMinutes: 840,
  achievements: { unlocked: 20, total: 50 },
  signal: null,
  confidence: null,
  finaleAchievement: null,
  ...overrides,
});

describe('swipeDirection', () => {
  it('needs to go past the threshold', () => {
    expect(swipeDirection(89, 0, 90)).toBeNull();
    expect(swipeDirection(90, 0, 90)).toBe('right');
  });

  it('follows the longest axis on a diagonal', () => {
    expect(swipeDirection(-120, 80, 90)).toBe('left');
    expect(swipeDirection(40, 130, 90)).toBe('down');
    expect(swipeDirection(-30, -100, 90)).toBe('up');
  });
});

describe('ANSWER_BY_DIRECTION', () => {
  it('matches the plan: right yes, left no, down dropped, up won’t play', () => {
    expect(ANSWER_BY_DIRECTION).toEqual({
      right: 'finished',
      left: 'notFinished',
      down: 'abandoned',
      up: 'wontPlay',
    });
  });
});

describe('monthsSince', () => {
  it('counts whole months, at least one', () => {
    expect(monthsSince('2026-03-16T12:00:00Z', now)).toBe(7);
    expect(monthsSince('2026-10-10T12:00:00Z', now)).toBe(1);
  });
});

describe('reasonFor', () => {
  it('names the finale achievement and what it asks for', () => {
    expect(
      reasonFor(
        card({
          signal: 'FINALE_ACHIEVEMENT',
          finaleAchievement: {
            name: 'Careful Merchant',
            description: 'Complete the game under 40 deaths',
          },
        }),
        now,
        hours,
      ),
    ).toEqual({
      key: 'review.reason.finale',
      values: {
        name: 'Careful Merchant',
        description: 'Complete the game under 40 deaths',
      },
    });
  });

  it('names a hidden finale achievement without its empty description', () => {
    expect(
      reasonFor(
        card({
          signal: 'FINALE_ACHIEVEMENT',
          finaleAchievement: { name: 'The Final Battle', description: '' },
        }),
        now,
        hours,
      ).key,
    ).toBe('review.reason.finaleHidden');
  });

  it('compares playtime with the main story', () => {
    expect(reasonFor(card({ signal: 'PLAYTIME' }), now, hours)).toEqual({
      key: 'review.reason.playtime',
      values: { played: '10 h', story: '14 h' },
    });
  });

  it('counts every achievement', () => {
    expect(
      reasonFor(
        card({
          signal: 'ALL_ACHIEVEMENTS',
          achievements: { unlocked: 12, total: 12 },
        }),
        now,
        hours,
      ),
    ).toEqual({ key: 'review.reason.allAchievements', values: { total: 12 } });
  });

  it('just shows the playtime on a first-time card', () => {
    expect(reasonFor(card(), now, hours)).toEqual({
      key: 'review.reason.played',
      values: { played: '10 h' },
    });
  });

  it('says how long a paused game has been waiting', () => {
    expect(
      reasonFor(
        card({ question: 'abandoned', lastPlayedAt: '2026-03-16T12:00:00Z' }),
        now,
        hours,
      ),
    ).toEqual({
      key: 'review.reason.paused',
      values: { count: 7, played: '10 h' },
    });
    expect(reasonFor(card({ question: 'abandoned' }), now, hours).key).toBe(
      'review.reason.pausedLongAgo',
    );
  });
});
