import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MeSchema, type Me, type UpdateMeRequest } from '@psq/shared';
import { authRequest } from './client';

export async function fetchMe(): Promise<Me> {
  return MeSchema.parse(await authRequest('/api/me'));
}

/** The signed-in user. Cached: every screen can call it without new requests. */
export function useMe({ enabled = true } = {}) {
  return useQuery({ queryKey: ['me'], queryFn: fetchMe, enabled });
}

/**
 * Changes the language or the recommendation weights. The new profile
 * replaces the cached one, so the layout switches the language at once.
 */
export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (changes: UpdateMeRequest): Promise<Me> =>
      MeSchema.parse(
        await authRequest('/api/me', {
          method: 'PATCH',
          body: JSON.stringify(changes),
        }),
      ),
    onSuccess: (me, changes) => {
      queryClient.setQueryData(['me'], me);
      if (changes.weights !== undefined) {
        // Other weights, another ranking.
        void queryClient.invalidateQueries({ queryKey: ['recommendation'] });
        void queryClient.invalidateQueries({
          queryKey: ['recommendation-ranking'],
        });
      }
    },
  });
}
