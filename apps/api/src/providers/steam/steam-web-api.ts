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
          name: z.string().optional(),
          // Minutes played in total and in the last two weeks.
          playtime_forever: z.number().int().optional(),
          playtime_2weeks: z.number().int().optional(),
          // Last session, in seconds since 1970; 0 if never played.
          rtime_last_played: z.number().int().optional(),
        }),
      )
      .optional(),
  }),
});

export interface SteamOwnedGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  playtimeTwoWeeksMinutes: number;
  lastPlayedAt: Date | null;
}

export interface SteamOwnedGames {
  gameCount: number;
  games: SteamOwnedGame[];
}

const PlayerAchievementsSchema = z.object({
  playerstats: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    achievements: z
      .array(
        z.object({
          apiname: z.string(),
          achieved: z.number().int(),
          // Seconds since 1970; 0 if locked.
          unlocktime: z.number().int(),
          name: z.string().optional(),
          description: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export interface SteamAchievement {
  apiName: string;
  name: string;
  description: string;
  unlockedAt: Date | null;
}

const WishlistSchema = z.object({
  response: z.object({
    items: z
      .array(
        z.object({
          appid: z.number().int(),
          priority: z.number().int().optional(),
          // Seconds since 1970.
          date_added: z.number().int().optional(),
        }),
      )
      .optional(),
  }),
});

export interface SteamWishlistItem {
  appId: number;
  priority: number | null;
  addedAt: Date | null;
}

/** Visibility value Steam uses for a public profile. */
export const STEAM_PUBLIC_PROFILE = 3;

/**
 * Client for the official Steam Web API (api.steampowered.com).
 * It only translates Steam's answers into tidy types: deciding what they
 * mean for the app is the job of the Steam library provider.
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
        include_appinfo: '1',
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
        name: game.name ?? `App ${game.appid}`,
        playtimeMinutes: game.playtime_forever ?? 0,
        playtimeTwoWeeksMinutes: game.playtime_2weeks ?? 0,
        lastPlayedAt: fromUnixSeconds(game.rtime_last_played),
      })),
    };
  }

  /**
   * Achievements of an account in one game, in English (names are used to
   * spot "finish the game" achievements). Null if the game has none.
   */
  async getPlayerAchievements(
    steamId: string,
    appId: number,
  ): Promise<SteamAchievement[] | null> {
    const path = 'ISteamUserStats/GetPlayerAchievements/v1/';
    const response = await this.request(path, {
      steamid: steamId,
      appid: String(appId),
      l: 'english',
    });
    // Games without stats answer 400 with a body that says so.
    if (!response.ok && response.status !== 400) {
      throw new Error(
        `Steam Web API ${path} responded with ${response.status}`,
      );
    }
    const { playerstats } = PlayerAchievementsSchema.parse(
      await response.json(),
    );
    if (!playerstats.success) {
      if (playerstats.error?.toLowerCase().includes('no stats')) {
        return null;
      }
      throw new Error(`Steam Web API ${path} failed: ${playerstats.error}`);
    }
    const achievements = playerstats.achievements ?? [];
    if (achievements.length === 0) {
      return null;
    }
    return achievements.map((achievement) => ({
      apiName: achievement.apiname,
      name: achievement.name ?? achievement.apiname,
      description: achievement.description ?? '',
      unlockedAt:
        achievement.achieved === 1
          ? (fromUnixSeconds(achievement.unlocktime) ?? new Date(0))
          : null,
    }));
  }

  /** Wishlist of an account. Empty if it's private or there's nothing in it. */
  async getWishlist(steamId: string): Promise<SteamWishlistItem[]> {
    const body = WishlistSchema.parse(
      await this.get('IWishlistService/GetWishlist/v1/', { steamid: steamId }),
    );
    return (body.response.items ?? []).map((item) => ({
      appId: item.appid,
      priority: item.priority ?? null,
      addedAt: fromUnixSeconds(item.date_added),
    }));
  }

  private async get(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const response = await this.request(path, params);
    if (!response.ok) {
      // Only the path: the full URL contains the key.
      throw new Error(
        `Steam Web API ${path} responded with ${response.status}`,
      );
    }
    // Validated by the caller: if Steam changes its response, it fails there.
    return response.json();
  }

  private request(path: string, params: Record<string, string>) {
    const url = new URL(path, 'https://api.steampowered.com/');
    url.searchParams.set('key', this.key);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }
    return fetch(url, { signal: AbortSignal.timeout(10_000) });
  }
}

/** Steam dates come as seconds since 1970, with 0 meaning "never". */
function fromUnixSeconds(seconds: number | undefined): Date | null {
  return seconds ? new Date(seconds * 1000) : null;
}
