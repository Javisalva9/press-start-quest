import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReviewQueueSchema, type ReviewQueue } from '@psq/shared';
import type { ReviewAnswer } from '../review';
import { authRequest } from './client';

/** Cards waiting for an answer, most likely finished first. */
export function useReviewQueue(limit: number) {
  return useQuery({
    queryKey: ['review-queue', limit],
    queryFn: async (): Promise<ReviewQueue> =>
      ReviewQueueSchema.parse(
        await authRequest(`/api/library/review-queue?limit=${limit}`),
      ),
  });
}

export function useAnswerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      answer,
    }: {
      id: string;
      answer: ReviewAnswer;
    }) => {
      await authRequest(`/api/library/review-queue/${encodeURIComponent(id)}`, {
        method: 'POST',
        body: JSON.stringify({ answer }),
      });
    },
    onSuccess: (_result, { id }) => {
      // Statuses changed: the library and the game page show them.
      void queryClient.invalidateQueries({ queryKey: ['library'] });
      void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['library-game', id] });
    },
  });
}
