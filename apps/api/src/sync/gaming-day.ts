/** Until this hour, a session still counts for the day before. */
export const DAY_ENDS_AT_HOUR = 4;

/** For now every player is in Spain; per-user time zones can come later. */
export const DEFAULT_TIME_ZONE = 'Europe/Madrid';

/**
 * The "gaming day" a moment belongs to, as YYYY-MM-DD: the calendar day
 * in the player's time zone, but ending at 4:00 instead of midnight. A
 * session that goes past midnight counts for the evening it started, and
 * the nightly sync (after midnight) files last night under yesterday.
 */
export function gamingDay(moment: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const shifted = new Date(moment.getTime() - DAY_ENDS_AT_HOUR * 3_600_000);
  // en-CA writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}
