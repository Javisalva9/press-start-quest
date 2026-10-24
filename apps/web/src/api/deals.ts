import { useQuery } from '@tanstack/react-query';
import {
  DealsResponseSchema,
  FreeGamesResponseSchema,
  type DealsResponse,
  type FreeGamesResponse,
} from '@psq/shared';
import { authRequest } from './client';

/** The priced games of the wishlist; prices change once a night. */
export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: async (): Promise<DealsResponse> =>
      DealsResponseSchema.parse(await authRequest('/api/deals')),
  });
}

/** Games given away this week in official stores. */
export function useFreeGames() {
  return useQuery({
    queryKey: ['deals', 'free'],
    queryFn: async (): Promise<FreeGamesResponse> =>
      FreeGamesResponseSchema.parse(await authRequest('/api/deals/free')),
  });
}
