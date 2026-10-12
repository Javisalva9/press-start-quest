import { useQuery } from '@tanstack/react-query';
import { MeSchema, type Me } from '@psq/shared';
import { authRequest } from './client';

export async function fetchMe(): Promise<Me> {
  return MeSchema.parse(await authRequest('/api/me'));
}

/** The signed-in user. Cached: every screen can call it without new requests. */
export function useMe({ enabled = true } = {}) {
  return useQuery({ queryKey: ['me'], queryFn: fetchMe, enabled });
}
