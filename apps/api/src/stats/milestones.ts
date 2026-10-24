import type { Milestone, StatsMilestones } from '@psq/shared';

/** Games completed in total that make a milestone. */
export const COMPLETED_TARGETS = [1, 5, 10, 25, 50, 100, 250];

/** Gaming days in a row that make a milestone. */
export const STREAK_TARGETS = [3, 7, 14, 30, 60, 100];

/**
 * The milestones, worked out from the history every time: nothing to
 * keep in sync, and a status changed by hand moves them at once.
 *
 * - Completed: the day of the nth completion (the review dated the old
 *   ones on the day of the answer).
 * - Streak: the day the best run of gaming days got that long.
 * - Month: the first game completed this month; it starts again on the
 *   1st, so there's always a small one within reach.
 */
export function milestones(
  completedDays: string[],
  playedDays: string[],
  today: string,
): StatsMilestones {
  const completed = [...completedDays].sort();
  const reached: Milestone[] = [];
  const next: Milestone[] = [];

  for (const target of COMPLETED_TARGETS) {
    const reachedOn = completed[target - 1] ?? null;
    const milestone: Milestone = {
      kind: 'COMPLETED',
      target,
      current: completed.length,
      reachedOn,
    };
    if (reachedOn) {
      reached.push(milestone);
    } else {
      next.push(milestone);
      break;
    }
  }

  const runs = streakDays(playedDays);
  for (const target of STREAK_TARGETS) {
    const reachedOn = runs.reachedOn.get(target) ?? null;
    const milestone: Milestone = {
      kind: 'STREAK',
      target,
      current: runs.best,
      reachedOn,
    };
    if (reachedOn) {
      reached.push(milestone);
    } else {
      next.push(milestone);
      break;
    }
  }

  const month = today.slice(0, 7);
  const thisMonth = completed.filter((day) => day.startsWith(month));
  const monthly: Milestone = {
    kind: 'MONTH',
    target: 1,
    current: thisMonth.length,
    reachedOn: thisMonth[0] ?? null,
  };
  (monthly.reachedOn ? reached : next).push(monthly);

  return {
    reached: reached.sort(
      (a, b) => b.reachedOn!.localeCompare(a.reachedOn!) || b.target - a.target,
    ),
    next,
  };
}

/** The best run of days in a row, and the day it first got each length. */
function streakDays(days: string[]): {
  best: number;
  reachedOn: Map<number, string>;
} {
  const sorted = [...new Set(days)].sort();
  const reachedOn = new Map<number, string>();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    run = previous && day === nextDay(previous) ? run + 1 : 1;
    previous = day;
    if (run > best) {
      best = run;
      reachedOn.set(run, day);
    }
  }
  return { best, reachedOn };
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
