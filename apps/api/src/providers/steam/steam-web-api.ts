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
        // 3 = public profile; anything else (1) = private or friends only.
        communityvisibilitystate: z.number().int().optional(),
      }),
    ),
  }),
});

export type SteamPlayerSummary = z.infer<
  typeof PlayerSummariesSchema
>['response']['players'][number];

const OwnedGamesSchema = z.object({
  response: z.object({
    game_count: z.number().int().optional(),
    games: z
      .array(
        z.object({
          appid: z.number().int(),
          // Minutes played in total.
          playtime_forever: z.number().int().optional(),
        }),
      )
      .optional(),
  }),
});

export interface SteamOwnedGames {
  gameCount: number;
  games: Array<{ appId: number; playtimeMinutes: number }>;
}

/** Visibility value Steam uses for a public profile. */
export const STEAM_PUBLIC_PROFILE = 3;

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
    const body = PlayerSummariesSchema.parse(
      await this.get('ISteamUser/GetPlayerSummaries/v2/', {
        steamids: steamId,
      }),
    );
    return body.response.players[0] ?? null;
  }

  /**
   * Games owned by an account (free-to-play ones only if played), or null
   * when its game details are private: Steam then answers an empty object.
   */
  async getOwnedGames(steamId: string): Promise<SteamOwnedGames | null> {
    const body = OwnedGamesSchema.parse(
      await this.get('IPlayerService/GetOwnedGames/v1/', {
        steamid: steamId,
        include_played_free_games: '1',
      }),
    );
    const { game_count: gameCount, games = [] } = body.response;
    if (gameCount === undefined) {
      return null;
    }
    return {
      gameCount,
      games: games.map((game) => ({
        appId: game.appid,
        playtimeMinutes: game.playtime_forever ?? 0,
      })),
    };
  }

  private async get(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const url = new URL(path, 'https://api.steampowered.com/');
    url.searchParams.set('key', this.key);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      // Only the path: the full URL contains the key.
      throw new Error(
        `Steam Web API ${path} responded with ${response.status}`,
      );
    }
    // Validated by the caller: if Steam changes its response, it fails there.
    return response.json();
  }
}
