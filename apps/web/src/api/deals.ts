import { useQuery } from '@tanstack/react-query';
import { DealsResponseSchema, type DealsResponse } from '@psq/shared';
import { authRequest } from './client';

/** The priced games of the wishlist; prices change once a night. */
export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: async (): Promise<DealsResponse> =>
      DealsResponseSchema.parse(await authRequest('/api/deals')),
  });
}
