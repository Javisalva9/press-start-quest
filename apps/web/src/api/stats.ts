import { useQuery } from '@tanstack/react-query';
import { StatsOverviewSchema, type StatsOverview } from '@psq/shared';
import { authRequest } from './client';

/** Progress counts and streaks for the home screen. */
export function useStatsOverview() {
  return useQuery({
    queryKey: ['stats-overview'],
    queryFn: async (): Promise<StatsOverview> =>
      StatsOverviewSchema.parse(await authRequest('/api/stats/overview')),
  });
}
