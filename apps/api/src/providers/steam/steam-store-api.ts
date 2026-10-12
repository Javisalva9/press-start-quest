import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const AppDetailsSchema = z.record(
  z.string(),
  z.object({
    success: z.boolean(),
    data: z
      .object({
        // game, dlc, demo, music, mod, video, series, episode, hardware…
        type: z.string(),
        name: z.string(),
        short_description: z.string().optional(),
        header_image: z.string().optional(),
        developers: z.array(z.string()).optional(),
        genres: z.array(z.object({ description: z.string() })).optional(),
        categories: z.array(z.object({ description: z.string() })).optional(),
        metacritic: z.object({ score: z.number().int() }).optional(),
        release_date: z
          .object({ coming_soon: z.boolean(), date: z.string() })
          .optional(),
        // For DLC and demos: the game they belong to.
        fullgame: z
          .object({ appid: z.union([z.string(), z.number()]) })
          .optional(),
      })
      .optional(),
  }),
);

export interface SteamAppDetails {
  appId: number;
  /** Steam's own label: game, dlc, demo, music… */
  type: string;
  name: string;
  summary: string | null;
  /** Wide banner (460×215), used at the top of a game's page. */
  headerImageUrl: string | null;
  developer: string | null;
  genres: string[];
  /** Single-player, Multi-player, MMO, PvP… */
  categories: string[];
  metacritic: number | null;
  releaseDate: Date | null;
  /** For DLC and demos: the appid of the full game. */
  fullGameAppId: number | null;
}

/** Steam answered 429: wait before asking again. */
export class SteamStoreRateLimitError extends Error {}

/**
 * Client for the public Steam Store API (store.steampowered.com/api).
 * It has no key and no documentation, and a low request limit (around 200
 * every 5 minutes): callers must space requests out and cache the results.
 */
@Injectable()
export class SteamStoreApi {
  /**
   * Store page data of an app, in English. Null when Steam has no store
   * page for it (removed games, most Playtests…).
   */
  async getAppDetails(appId: number): Promise<SteamAppDetails | null> {
    const url = new URL('https://store.steampowered.com/api/appdetails');
    url.searchParams.set('appids', String(appId));
    url.searchParams.set('l', 'english');

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (response.status === 429) {
      throw new SteamStoreRateLimitError('Steam Store rate limit reached');
    }
    if (!response.ok) {
      throw new Error(`Steam Store responded with ${response.status}`);
    }
    const body = AppDetailsSchema.parse(await response.json());
    const entry = body[String(appId)];
    if (!entry?.success || !entry.data) {
      return null;
    }

    const { data } = entry;
    return {
      appId,
      type: data.type,
      name: data.name,
      summary: data.short_description || null,
      headerImageUrl: data.header_image ?? null,
      developer: data.developers?.[0] ?? null,
      genres: data.genres?.map((genre) => genre.description) ?? [],
      categories:
        data.categories?.map((category) => category.description) ?? [],
      metacritic: data.metacritic?.score ?? null,
      releaseDate: parseReleaseDate(data.release_date),
      fullGameAppId: data.fullgame ? Number(data.fullgame.appid) : null,
    };
  }
}

/**
 * Steam sends the release date as text ("18 Apr, 2011" in English), or a
 * vague one ("Coming soon", "Q4 2026") for unreleased games.
 */
function parseReleaseDate(
  release: { coming_soon: boolean; date: string } | undefined,
): Date | null {
  if (!release || release.coming_soon) {
    return null;
  }
  const date = new Date(`${release.date} UTC`);
  return Number.isNaN(date.getTime()) ? null : date;
}
