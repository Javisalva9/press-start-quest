import { backlogPace, monthlyTimeline, type PlayedDay } from './timeline.js';

const played = (day: string, minutes: number, backlogMinutes = minutes) =>
  ({ day, minutes, backlogMinutes }) satisfies PlayedDay;

describe('monthlyTimeline', () => {
  it('adds up minutes and completions per month, empty months included', () => {
    expect(
      monthlyTimeline(
        [
          played('2026-08-30', 60),
          played('2026-08-31', 30),
          played('2026-10-02', 90),
        ],
        ['2026-08-15', '2026-10-01', '2026-10-20'],
        '2026-10-24',
      ),
    ).toEqual([
      { month: '2026-08', completed: 1, playedMinutes: 90 },
      { month: '2026-09', completed: 0, playedMinutes: 0 },
      { month: '2026-10', completed: 2, playedMinutes: 90 },
    ]);
  });

  it('shows only this month when there is nothing yet', () => {
    expect(monthlyTimeline([], [], '2026-10-24')).toEqual([
      { month: '2026-10', completed: 0, playedMinutes: 0 },
    ]);
  });

  it('goes back 12 months at most, across years', () => {
    const months = monthlyTimeline(
      [played('2025-01-10', 60), played('2025-11-10', 30)],
      [],
      '2026-10-24',
    );
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({
      month: '2025-11',
      completed: 0,
      playedMinutes: 30,
    });
    expect(months.at(-1)!.month).toBe('2026-10');
  });
});

describe('backlogPace', () => {
  it('has none without a week of history', () => {
    expect(backlogPace([], null, '2026-10-24', 600)).toBeNull();
    expect(
      backlogPace([played('2026-10-20', 60)], '2026-10-18', '2026-10-24', 600),
    ).toBeNull();
  });

  it('measures the last 30 days, leaving out endless games', () => {
    const pace = backlogPace(
      [
        // Out of the window.
        played('2026-09-24', 600),
        played('2026-10-01', 300),
        // A MOBA evening: hours played, none off the backlog.
        played('2026-10-10', 240, 0),
        played('2026-10-20', 300),
      ],
      '2026-08-01',
      '2026-10-24',
      6000,
    );
    // 600 minutes over 30 days: 20 a day, 300 days for 100 h.
    expect(pace).toEqual({ windowDays: 30, minutesPerDay: 20, etaDays: 300 });
  });

  it('uses the days since history started when there are fewer', () => {
    expect(
      backlogPace([played('2026-10-20', 100)], '2026-10-14', '2026-10-24', 100),
    ).toEqual({ windowDays: 10, minutesPerDay: 10, etaDays: 10 });
  });

  it('has no end date without play on the backlog', () => {
    expect(
      backlogPace(
        [played('2026-10-20', 240, 0)],
        '2026-10-01',
        '2026-10-24',
        600,
      ),
    ).toEqual({ windowDays: 23, minutesPerDay: 0, etaDays: null });
  });
});
