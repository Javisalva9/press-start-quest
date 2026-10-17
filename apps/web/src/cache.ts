import type { QueryKey } from '@tanstack/react-query';

/** Where the last answers from the API are kept between visits. */
export const CACHE_STORAGE_KEY = 'psq.query-cache';

/** Kept for a week: older than that, the app starts from scratch. */
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Data worth showing at once when the app opens, before the API answers.
 * An allow-list on purpose: a new query isn't kept until it's added here.
 * Left out: searches, sync progress and the review's card batch, which
 * mean nothing a day later.
 */
const PERSISTED: ReadonlySet<string> = new Set([
  'me',
  'stats-overview',
  'library',
  'library-game',
  'external-sources',
  'curators',
]);

export function shouldPersist(queryKey: QueryKey): boolean {
  const [name, detail] = queryKey;
  if (name === 'review-queue') {
    // Only the count on the home screen (limit 1).
    return detail === 1;
  }
  return typeof name === 'string' && PERSISTED.has(name);
}
