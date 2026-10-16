import { autoStatus, pausedLongEnough } from './auto-status.js';

const now = new Date('2026-10-16T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const game = {
  playtimeMin: 600,
  lastPlayedAt: daysAgo(1),
  gameType: 'COMPLETABLE' as const,
};

describe('autoStatus', () => {
  it('is playing when played in the last 30 days', () => {
    expect(autoStatus(game, now)).toBe('PLAYING');
    expect(autoStatus({ ...game, lastPlayedAt: daysAgo(30) }, now)).toBe(
      'PLAYING',
    );
  });

  it('is on hold right after, with no gap', () => {
    expect(autoStatus({ ...game, lastPlayedAt: daysAgo(31) }, now)).toBe(
      'ON_HOLD',
    );
    expect(autoStatus({ ...game, lastPlayedAt: daysAgo(400) }, now)).toBe(
      'ON_HOLD',
    );
  });

  it('is on hold when played but the store has no date', () => {
    expect(autoStatus({ ...game, lastPlayedAt: null }, now)).toBe('ON_HOLD');
  });

  it('is backlog with less than an hour, even if played yesterday', () => {
    expect(autoStatus({ ...game, playtimeMin: 59 }, now)).toBe('BACKLOG');
    expect(
      autoStatus({ ...game, playtimeMin: 0, lastPlayedAt: null }, now),
    ).toBe('BACKLOG');
  });

  it('never puts an endless game on hold', () => {
    const endless = { ...game, gameType: 'ENDLESS' as const };
    expect(autoStatus(endless, now)).toBe('PLAYING');
    expect(autoStatus({ ...endless, lastPlayedAt: daysAgo(100) }, now)).toBe(
      'BACKLOG',
    );
  });

  it('never decides "abandoned" by itself', () => {
    expect(autoStatus({ ...game, lastPlayedAt: daysAgo(3000) }, now)).not.toBe(
      'ABANDONED',
    );
  });
});

describe('pausedLongEnough', () => {
  it('asks after 3 months without playing', () => {
    expect(pausedLongEnough(daysAgo(89), now)).toBe(false);
    expect(pausedLongEnough(daysAgo(90), now)).toBe(true);
  });

  it('asks when the store has no date: played long ago', () => {
    expect(pausedLongEnough(null, now)).toBe(true);
  });
});
