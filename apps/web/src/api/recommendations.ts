import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  NextRecommendationSchema,
  RecommendationRankingSchema,
  type Mood,
  type NextRecommendation,
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
