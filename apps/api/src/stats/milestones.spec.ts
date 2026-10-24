import { milestones } from './milestones.js';

const TODAY = '2026-10-24';

describe('milestones', () => {
  it('has only the first ones ahead with no history', () => {
    expect(milestones([], [], TODAY)).toEqual({
      reached: [],
      next: [
        { kind: 'COMPLETED', target: 1, current: 0, reachedOn: null },
        { kind: 'STREAK', target: 3, current: 0, reachedOn: null },
        { kind: 'MONTH', target: 1, current: 0, reachedOn: null },
      ],
    });
  });

  it('dates each completed milestone on its nth completion', () => {
    const days = [
      '2026-10-05',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-06',
    ];
    const { reached, next } = milestones(days, [], TODAY);
    expect(reached.filter((m) => m.kind === 'COMPLETED')).toEqual([
      { kind: 'COMPLETED', target: 5, current: 6, reachedOn: '2026-10-05' },
      { kind: 'COMPLETED', target: 1, current: 6, reachedOn: '2026-10-01' },
    ]);
    expect(next[0]).toEqual({
      kind: 'COMPLETED',
      target: 10,
      current: 6,
      reachedOn: null,
    });
  });

  it('dates a streak on the day the best run got that long', () => {
    const played = [
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      // A break, then a longer run.
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ];
    const { reached, next } = milestones([], played, TODAY);
    expect(reached.filter((m) => m.kind === 'STREAK')).toEqual([
      { kind: 'STREAK', target: 7, current: 7, reachedOn: '2026-10-16' },
      { kind: 'STREAK', target: 3, current: 7, reachedOn: '2026-10-03' },
    ]);
    expect(next).toContainEqual({
      kind: 'STREAK',
      target: 14,
      current: 7,
      reachedOn: null,
    });
  });

  it('starts the monthly one again every month', () => {
    expect(
      milestones(['2026-09-20'], [], TODAY).next.find(
        (m) => m.kind === 'MONTH',
      ),
    ).toEqual({ kind: 'MONTH', target: 1, current: 0, reachedOn: null });
    expect(
      milestones(['2026-09-20', '2026-10-21', '2026-10-03'], [], TODAY)
        .reached[0],
    ).toEqual({
      kind: 'MONTH',
      target: 1,
      current: 2,
      reachedOn: '2026-10-03',
    });
  });
});
