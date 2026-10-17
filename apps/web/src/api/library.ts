import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  LibraryGameSchema,
  LibraryPageSchema,
  LibraryQuerySchema,
  type LibraryGame,
  type LibraryPage,
  type LibraryQuery,
  type UpdateLibraryGameRequest,
} from '@psq/shared';
import { authRequest } from './client';

/** Filters a screen can choose; paging is handled by the hook. */
export type LibraryFilters = Omit<LibraryQuery, 'page' | 'pageSize'>;

const DEFAULTS = LibraryQuerySchema.parse({});

/**
 * Filters as a query string, leaving out the default values so URLs stay
 * short: { view: 'library', status: ['BACKLOG'] } → "status=BACKLOG".
 * Used both for the API and for the screen's own URL.
 */
export function toSearchParams(query: Partial<LibraryQuery>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === DEFAULTS[name as keyof LibraryQuery]) {
      continue;
    }
    params.set(name, Array.isArray(value) ? value.join(',') : String(value));
  }
  return params;
}

/** The filters that narrow the list (the order doesn't): to count and clear. */
export const CLEARABLE_FILTERS = {
  q: undefined,
  status: undefined,
  length: undefined,
  source: undefined,
} satisfies Partial<LibraryFilters>;

/** How many filters are narrowing the list; each status chip counts. */
export function activeFilterCount(filters: LibraryFilters): number {
  return (
    (filters.q ? 1 : 0) +
    (filters.status?.length ?? 0) +
    (filters.length ? 1 : 0) +
    (filters.source ? 1 : 0)
  );
}

/** Reads the filters from the screen's URL; anything invalid falls back. */
export function filtersFromSearchParams(
  params: URLSearchParams,
): LibraryFilters {
  const parsed = LibraryQuerySchema.safeParse(Object.fromEntries(params));
  const {
    page: _page,
    pageSize: _pageSize,
    ...filters
  } = parsed.success ? parsed.data : DEFAULTS;
  return filters;
}

const PAGE_SIZE = 48;

/** The library, one page at a time ("Load more" asks for the next one). */
export function useLibrary(filters: LibraryFilters) {
  return useInfiniteQuery({
    queryKey: ['library', filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<LibraryPage> => {
      const params = toSearchParams({
        ...filters,
        page: pageParam,
        pageSize: PAGE_SIZE,
      });
      return LibraryPageSchema.parse(
        await authRequest(`/api/library?${params}`),
      );
    },
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
}

export function useLibraryGame(id: string) {
  return useQuery({
    queryKey: ['library-game', id],
    queryFn: async (): Promise<LibraryGame> =>
      LibraryGameSchema.parse(
        await authRequest(`/api/library/${encodeURIComponent(id)}`),
      ),
  });
}

/** Sets (or clears, with null) the length of a game by hand. */
export function useSetLength(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (minutes: number | null): Promise<LibraryGame> =>
      LibraryGameSchema.parse(
        await authRequest(`/api/library/${encodeURIComponent(id)}/length`, {
          method: 'PATCH',
          body: JSON.stringify({ minutes }),
        }),
      ),
    onSuccess: (game) => {
      queryClient.setQueryData(['library-game', id], game);
      // Lists show the length too (and the length filter depends on it).
      void queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
}

/** The player's own status, type or servers; null hands each back to the app. */
export function useUpdateLibraryGame(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      changes: UpdateLibraryGameRequest,
    ): Promise<LibraryGame> =>
      LibraryGameSchema.parse(
        await authRequest(`/api/library/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(changes),
        }),
      ),
    onSuccess: (game) => {
      queryClient.setQueryData(['library-game', id], game);
      // Lists filter by status, and a status set by hand leaves the review.
      void queryClient.invalidateQueries({ queryKey: ['library'] });
      void queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
    },
  });
}

/** Takes a game out of "Lo quiero" for good (it's hidden, not deleted). */
export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await authRequest(`/api/library/${encodeURIComponent(id)}/wishlist`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: ['library-game', id] });
      void queryClient.invalidateQueries({ queryKey: ['library'] });
      void queryClient.invalidateQueries({ queryKey: ['curators'] });
    },
  });
}
