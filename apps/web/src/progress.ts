import { formatHours } from './format';

/** Share of completed games in the ring, as a whole percentage. */
export function ringPercent(completed: number, pending: number): number {
  const total = completed + pending;
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

/**
 * When the backlog would be done, as an amount and a unit for
 * Intl.RelativeTimeFormat ("in 3 weeks", "dentro de 8 meses"): days up to
 * two weeks, then weeks, months, and years with one decimal.
 */
export function etaParts(days: number): {
  value: number;
  unit: 'day' | 'week' | 'month' | 'year';
} {
  if (days < 14) {
    return { value: Math.max(1, days), unit: 'day' };
  }
  if (days < 60) {
    return { value: Math.round(days / 7), unit: 'week' };
  }
  if (days < 730) {
    return { value: Math.round(days / 30.44), unit: 'month' };
  }
  return { value: Math.round((days / 365.25) * 10) / 10, unit: 'year' };
}

/** "in 8 months" / "dentro de 8 meses". */
export function formatEta(days: number, language: string): string {
  const { value, unit } = etaParts(days);
  return new Intl.RelativeTimeFormat(language, { numeric: 'always' }).format(
    value,
    unit,
  );
}

/** A day's playtime: "45 min" under an hour, else "1,5 h". */
export function formatDailyTime(minutes: number, language: string): string {
  if (minutes < 60) {
    return new Intl.NumberFormat(language, {
      style: 'unit',
      unit: 'minute',
      unitDisplay: 'short',
      maximumFractionDigits: 0,
    }).format(minutes);
  }
  return formatHours(minutes, language);
}

/** "oct" / "Oct" for a YYYY-MM month. */
export function monthLabel(month: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}
