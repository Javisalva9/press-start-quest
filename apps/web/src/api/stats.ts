import { useQuery } from '@tanstack/react-query';
import {
  StatsOverviewSchema,
  StatsTimelineSchema,
  type StatsOverview,
  type StatsTimeline,
} from '@psq/shared';
import { authRequest } from './client';

/** Progress counts and streaks for the home screen. */
export function useStatsOverview() {
  return useQuery({
    queryKey: ['stats-overview'],
    queryFn: async (): Promise<StatsOverview> =>
      StatsOverviewSchema.parse(await authRequest('/api/stats/overview')),
  });
}

/**
 * Completed games and hours per month. Its key starts like the overview's,
 * so whatever refreshes the progress (a status changed) refreshes it too.
 */
export function useStatsTimeline() {
  return useQuery({
    queryKey: ['stats-overview', 'timeline'],
    queryFn: async (): Promise<StatsTimeline> =>
      StatsTimelineSchema.parse(await authRequest('/api/stats/timeline')),
  });
}
