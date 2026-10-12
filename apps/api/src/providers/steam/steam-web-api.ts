import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Env } from '../../config/env.js';

const PlayerSummariesSchema = z.object({
  response: z.object({
    players: z.array(
      z.object({
        steamid: z.string(),
        personaname: z.string(),
      }),
    ),
  }),
});

export type SteamPlayerSummary = z.infer<
  typeof PlayerSummariesSchema
>['response']['players'][number];

/**
 * Client for the official Steam Web API (api.steampowered.com).
 * The key travels in the URL, so URLs are never logged.
 */
@Injectable()
export class SteamWebApi {
  private readonly key: string;

  constructor(config: ConfigService<Env, true>) {
    this.key = config.get('STEAM_API_KEY', { infer: true });
  }

  /** Public profile of a Steam account, or null if Steam doesn't know it. */
  async getPlayerSummary(steamId: string): Promise<SteamPlayerSummary | null> {
    const url = new URL(
      'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/',
    );
    url.searchParams.set('key', this.key);
    url.searchParams.set('steamids', steamId);

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`Steam Web API responded with ${response.status}`);
    }
    // Validated: if Steam changes its response, it fails here, not deep inside.
    const body = PlayerSummariesSchema.parse(await response.json());
    return body.response.players[0] ?? null;
  }
}
