import { useQuery } from '@tanstack/react-query';
import { SteamPrivacySchema, type SteamPrivacy } from '@psq/shared';
import { authRequest } from './client';

export async function fetchSteamPrivacy(): Promise<SteamPrivacy> {
  return SteamPrivacySchema.parse(
    await authRequest('/api/sources/steam/privacy'),
  );
}

/** Whether the Steam profile lets the app read the library and playtime. */
export function useSteamPrivacy() {
  return useQuery({ queryKey: ['steam-privacy'], queryFn: fetchSteamPrivacy });
}
