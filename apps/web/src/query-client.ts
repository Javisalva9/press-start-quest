import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { ApiRequestError } from './api/client';
import { CACHE_MAX_AGE_MS, CACHE_STORAGE_KEY, shouldPersist } from './cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx answers won't change by retrying (no session, not found…).
      retry: (failureCount, error) =>
        !(error instanceof ApiRequestError && error.status < 500) &&
        failureCount < 2,
      // Data is considered fresh for a minute: moving between screens
      // doesn't refetch everything.
      staleTime: 60_000,
      // Unused data stays in memory as long as it's kept on the device;
      // with the default 5 minutes it would be dropped before being saved.
      gcTime: CACHE_MAX_AGE_MS,
    },
  },
});

/**
 * Keeps the last answers on the device, so the app opens with them while
 * the API wakes up, and swaps in the fresh ones when they arrive. Dropped
 * after a week, and on every deploy: data saved by an older version may
 * not have the shape the new screens expect.
 */
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createSyncStoragePersister({
    storage: window.localStorage,
    key: CACHE_STORAGE_KEY,
  }),
  maxAge: CACHE_MAX_AGE_MS,
  buster: __BUILD_ID__,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && shouldPersist(query.queryKey),
  },
};
