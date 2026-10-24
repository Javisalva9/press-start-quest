import type { StatsOverview, TimelineMonth } from '@psq/shared';

/** Minutes played on one gaming day, from the playtime photos. */
export interface PlayedDay {
  /** YYYY-MM-DD. */
  day: string;
  /** Every game. */
  minutes: number;
  /** Only games that count for the backlog: endless ones don't. */
  backlogMinutes: number;
}

/** How far back the monthly chart goes. */
export const TIMELINE_MONTHS = 12;

/**
 * How many months it always shows, empty ones before the history
 * included: one lonely bar filling the whole card looks broken.
 */
export const TIMELINE_MIN_MONTHS = 6;

/** The pace is measured over the last days, up to this many... */
export const PACE_WINDOW_DAYS = 30;

/** ...and needs at least this many: one good evening isn't a pace. */
export const PACE_MIN_DAYS = 7;

/**
 * Completed games and minutes played per month, from the first month
 * with anything (at most TIMELINE_MONTHS ago, at least TIMELINE_MIN_MONTHS)
 * up to this one, empty months included: a gap in the chart is a month
 * off, and that's worth seeing too.
 */
export function monthlyTimeline(
  days: PlayedDay[],
  completedDays: string[],
  today: string,
): TimelineMonth[] {
  const played = new Map<string, number>();
  for (const { day, minutes } of days) {
    const month = day.slice(0, 7);
    played.set(month, (played.get(month) ?? 0) + minutes);
  }
  const completed = new Map<string, number>();
  for (const day of completedDays) {
    const month = day.slice(0, 7);
    completed.set(month, (completed.get(month) ?? 0) + 1);
  }

  const current = today.slice(0, 7);
  const oldest = addMonths(current, -(TIMELINE_MONTHS - 1));
  const newestStart = addMonths(current, -(TIMELINE_MIN_MONTHS - 1));
  const first = [...played.keys(), ...completed.keys(), newestStart]
    .filter((month) => month >= oldest)
    .sort()[0]!;

  const months: TimelineMonth[] = [];
  for (let month = first; month <= current; month = addMonths(month, 1)) {
    months.push({
      month,
      completed: completed.get(month) ?? 0,
      playedMinutes: played.get(month) ?? 0,
    });
  }
  return months;
}

/**
 * The recent pace on games that count, and how long the hours left take
 * at it. The first day of history is left out of the window: its photos
 * are the starting point, with nothing played yet.
 */
export function backlogPace(
  days: PlayedDay[],
  since: string | null,
  today: string,
  remainingMinutes: number,
): StatsOverview['pace'] {
  if (!since) {
    return null;
  }
  const windowDays = Math.min(PACE_WINDOW_DAYS, daysBetween(since, today));
  if (windowDays < PACE_MIN_DAYS) {
    return null;
  }
  const from = addDays(today, -(windowDays - 1));
  const minutes = days
    .filter(({ day }) => day >= from && day <= today)
    .reduce((total, { backlogMinutes }) => total + backlogMinutes, 0);
  const minutesPerDay = minutes / windowDays;
  return {
    windowDays,
    minutesPerDay: Math.round(minutesPerDay * 10) / 10,
    etaDays:
      minutesPerDay > 0 ? Math.ceil(remainingMinutes / minutesPerDay) : null,
  };
}

function addMonths(month: string, amount: number): string {
  const [year, number] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, number - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
}

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Whole days from one to the other: 0 for the same day. */
function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}
