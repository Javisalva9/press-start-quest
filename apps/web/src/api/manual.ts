import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ExternalSourcesResponseSchema,
  GameSearchResponseSchema,
  LibraryGameSchema,
  type AddManualGameRequest,
  type GameSearchResult,
  type LibraryGame,
} from '@psq/shared';
import { authRequest } from './client';

/** PC games on IGDB for a text; off until it has two characters. */
export function useGameSearch(text: string) {
  const q = text.trim();
  return useQuery({
    queryKey: ['game-search', q],
    queryFn: async (): Promise<GameSearchResult[]> =>
      GameSearchResponseSchema.parse(
        await authRequest(`/api/games/search?q=${encodeURIComponent(q)}`),
      ).results,
    enabled: q.length >= 2,
    // Keep the last results on screen while the next search loads.
    placeholderData: keepPreviousData,
  });
}

/** The stores the player added by hand, to suggest them. */
export function useExternalSources() {
  return useQuery({
    queryKey: ['external-sources'],
    queryFn: async () =>
      ExternalSourcesResponseSchema.parse(
        await authRequest('/api/sources/external'),
      ).sources,
  });
}

export function useAddManualGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AddManualGameRequest): Promise<LibraryGame> =>
      LibraryGameSchema.parse(
        await authRequest('/api/library/manual', {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      ),
    onSuccess: (game) => {
      queryClient.setQueryData(['library-game', game.id], game);
      void queryClient.invalidateQueries({ queryKey: ['library'] });
      void queryClient.invalidateQueries({ queryKey: ['game-search'] });
      void queryClient.invalidateQueries({ queryKey: ['external-sources'] });
      void queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    },
  });
}
