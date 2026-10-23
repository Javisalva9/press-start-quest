import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  NextRecommendationSchema,
  RecommendationFeedbackSchema,
  RecommendationRankingSchema,
  type Mood,
  type NextRecommendation,
  type RecommendationFeedback,
  type RecommendationFeedbackAction,
  type RecommendationRanking,
} from '@psq/shared';
import { authRequest } from './client';

/** Your next game for a mood; skip is how many times "another one" was tapped. */
export function useNextRecommendation(mood: Mood | null, skip: number) {
  return useQuery({
    queryKey: ['recommendation', mood, skip],
    queryFn: async (): Promise<NextRecommendation> => {
      const params = new URLSearchParams({ skip: String(skip) });
      if (mood) {
        params.set('mood', mood);
      }
      return NextRecommendationSchema.parse(
        await authRequest(`/api/recommendations/next?${params}`),
      );
    },
    // "Another one" keeps the current card on screen until the next arrives.
    placeholderData: keepPreviousData,
  });
}

/** The best candidates with every factor, to tune the weights. */
export function useRecommendationRanking(mood: Mood | null) {
  return useQuery({
    queryKey: ['recommendation-ranking', mood],
    queryFn: async (): Promise<RecommendationRanking> => {
      const params = new URLSearchParams({ limit: '20' });
      if (mood) {
        params.set('mood', mood);
      }
      return RecommendationRankingSchema.parse(
        await authRequest(`/api/recommendations/ranking?${params}`),
      );
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * "Not now" or "I won't play it" on a recommended game. Afterwards (also
 * when it fails: the card may be old) the recommendations are loaded again.
 */
export function useRecommendationFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      action,
      mood,
    }: {
      id: string;
      action: RecommendationFeedbackAction;
      mood: Mood | null;
    }): Promise<RecommendationFeedback> =>
      RecommendationFeedbackSchema.parse(
        await authRequest(
          `/api/recommendations/${encodeURIComponent(id)}/feedback`,
          { method: 'POST', body: JSON.stringify({ action, mood }) },
        ),
      ),
    onSuccess: (result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['library-game', id] });
      if (result.action === 'NEVER') {
        // Out of the backlog: lists, counts and the taste change too.
        void queryClient.invalidateQueries({ queryKey: ['library'] });
        void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['recommendation'] });
      void queryClient.invalidateQueries({
        queryKey: ['recommendation-ranking'],
      });
    },
  });
}
