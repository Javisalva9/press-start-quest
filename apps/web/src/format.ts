/**
 * Minutes as hours, in the user's language: "12 h", "1,5 h" / "1.5 h".
 * One decimal below 10 h (where half an hour matters), whole hours above.
 */
export function formatHours(minutes: number, language: string): string {
  const hours = minutes / 60;
  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit: 'hour',
    unitDisplay: 'narrow',
    maximumFractionDigits: hours < 10 ? 1 : 0,
  }).format(hours);
}

/** Year of an ISO date, or null. */
export function yearOf(isoDate: string | null): number | null {
  return isoDate ? new Date(isoDate).getUTCFullYear() : null;
}
