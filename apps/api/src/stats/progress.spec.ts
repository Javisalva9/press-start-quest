import { streaks, summarizeProgress, type ProgressEntry } from './progress.js';

const game = (overrides: Partial<ProgressEntry> = {}): ProgressEntry => ({
  status: 'BACKLOG',
  gameType: 'COMPLETABLE',
  serverStatus: 'UNKNOWN',
  playtimeMin: 0,
  ttbMainMin: 600,
  ...overrides,
});

describe('summarizeProgress', () => {
  it('puts each game in one box, by the plan rules', () => {
    expect(
      summarizeProgress([
        game({ status: 'COMPLETED' }),
        // Completed counts even with the servers closed afterwards.
        game({ status: 'COMPLETED', serverStatus: 'CLOSED' }),
        game({ status: 'PLAYING' }),
        game({ status: 'ON_HOLD' }),
        game({ gameType: 'SANDBOX' }),
        game({ gameType: 'UNKNOWN' }),
        game({ status: 'ABANDONED' }),
        game({ serverStatus: 'CLOSED' }),
        game({ gameType: 'ENDLESS', status: 'PLAYING' }),
        game({ status: 'DISCARDED', gameType: 'ENDLESS' }),
      ]),
    ).toMatchObject({
      completed: 2,
      pending: 4,
      abandoned: 1,
      closed: 1,
      endless: 1,
      discarded: 1,
    });
  });

  it('adds up the main story left, never below zero', () => {
    expect(
      summarizeProgress([
        game({ playtimeMin: 200, ttbMainMin: 600 }),
        // Played past its length: nothing left, not negative.
        game({ playtimeMin: 900, ttbMainMin: 600 }),
      ]).remainingMinutes,
    ).toBe(400);
  });

  it('counts apart the pending games with no length, but not sandboxes', () => {
    expect(
      summarizeProgress([
        game({ ttbMainMin: null }),
        game({ ttbMainMin: null, gameType: 'SANDBOX' }),
        game({ ttbMainMin: 3000, gameType: 'SANDBOX' }),
      ]),
    ).toMatchObject({
      pending: 3,
      pendingWithoutLength: 1,
      remainingMinutes: 0,
    });
  });
});

describe('streaks', () => {
  it('has none without days played', () => {
    expect(streaks([], '2026-10-17')).toEqual({
      current: 0,
      best: 0,
      lastPlayedDay: null,
    });
  });

  it('keeps the current streak alive if the last day was yesterday', () => {
    expect(
      streaks(['2026-10-14', '2026-10-15', '2026-10-16'], '2026-10-17'),
    ).toEqual({ current: 3, best: 3, lastPlayedDay: '2026-10-16' });
  });

  it('breaks it after a day without playing, keeping the best', () => {
    expect(
      streaks(
        ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10'],
        '2026-10-17',
      ),
    ).toEqual({ current: 0, best: 3, lastPlayedDay: '2026-10-10' });
  });

  it('counts across months and ignores repeated days and order', () => {
    expect(
      streaks(['2026-11-01', '2026-10-31', '2026-10-31'], '2026-11-01'),
    ).toEqual({ current: 2, best: 2, lastPlayedDay: '2026-11-01' });
  });
});
