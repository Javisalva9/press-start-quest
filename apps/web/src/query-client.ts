import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api/client';

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
    },
  },
});
