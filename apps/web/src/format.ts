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

/**
 * Hours typed by the player, as whole minutes: "10", "1,5" or "1.5".
 * Null for anything else, or a negative or absurd number.
 */
export function parseHours(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const minutes = Math.round(Number(trimmed) * 60);
  return minutes <= 1_000_000 ? minutes : null;
}
