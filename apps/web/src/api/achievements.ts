import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GameAchievementSchema,
  GameAchievementsResponseSchema,
  type GameAchievement,
} from '@psq/shared';
import { authRequest } from './client';

/** A game's achievements, only once the section is opened. */
export function useGameAchievements(userGameId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['achievements', userGameId],
    queryFn: async (): Promise<GameAchievement[]> =>
      GameAchievementsResponseSchema.parse(
        await authRequest(
          `/api/library/${encodeURIComponent(userGameId)}/achievements`,
        ),
      ).achievements,
    enabled,
  });
}

export function useFinaleVote(userGameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      achievementId,
      vote,
    }: {
      achievementId: string;
      vote: boolean | null;
    }): Promise<GameAchievement> =>
      GameAchievementSchema.parse(
        await authRequest(
          `/api/library/${encodeURIComponent(userGameId)}/achievements/${encodeURIComponent(achievementId)}/finale-vote`,
          { method: 'PUT', body: JSON.stringify({ isFinale: vote }) },
        ),
      ),
    onSuccess: (achievement) => {
      queryClient.setQueryData<GameAchievement[]>(
        ['achievements', userGameId],
        (list) =>
          list?.map((item) =>
            item.id === achievement.id ? achievement : item,
          ),
      );
      // The vote may make a game look finished: the review shows it.
      void queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    },
  });
}
