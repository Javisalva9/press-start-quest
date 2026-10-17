import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CuratorSummarySchema,
  CuratorsResponseSchema,
  type CuratorSummary,
} from '@psq/shared';
import { authRequest } from './client';

/** Curators to follow, with their numbers for this player. */
export function useCurators() {
  return useQuery({
    queryKey: ['curators'],
    queryFn: async (): Promise<CuratorSummary[]> =>
      CuratorsResponseSchema.parse(await authRequest('/api/curators')).curators,
  });
}

/** Follow or unfollow: either way "Lo quiero" and the labels change. */
export function useFollowCurator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      follow,
    }: {
      id: string;
      follow: boolean;
    }): Promise<CuratorSummary> =>
      CuratorSummarySchema.parse(
        await authRequest(`/api/curators/${encodeURIComponent(id)}/follow`, {
          method: follow ? 'POST' : 'DELETE',
        }),
      ),
    onSuccess: (curator) => {
      queryClient.setQueryData<CuratorSummary[]>(['curators'], (list) =>
        list?.map((item) => (item.id === curator.id ? curator : item)),
      );
      void queryClient.invalidateQueries({ queryKey: ['library'] });
      void queryClient.invalidateQueries({ queryKey: ['library-game'] });
    },
  });
}
