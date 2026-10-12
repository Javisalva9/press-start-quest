import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';
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

/** Steam kept answering 429 even after waiting. */
export class SteamStoreRateLimitError extends Error {}

/** How long to wait after a 429 before trying once more. */
export const RATE_LIMIT_PAUSE_MS = 60_000;

/** How long an answer is reused (see `recent`). */
const RECENT_TTL_MS = 10 * 60 * 1000;

/**
 * Client for the public Steam Store API (store.steampowered.com/api).
 * It has no key and no documentation, and a low request limit: around 200
 * requests every 5 minutes. Every request goes through one queue that sends
 * one every 1.6 s, and the results are cached in the database for 30 days.
 */
@Injectable()
export class SteamStoreApi {
  private readonly queue = new PQueue({
    concurrency: 1,
    intervalCap: 1,
    interval: 1600,
  });
  /**
   * Answers from the last few minutes, by appid: the wishlist import and
   * the enrichment of the same sync ask for the same new games, and the
   * store is too slow to ask twice.
   */
  private readonly recent = new Map<
    number,
    { details: Promise<SteamAppDetails | null>; expiresAt: number }
  >();

  /**
   * Store page data of an app, in English. Null when Steam has no store
   * page for it (removed games, most Playtests…).
   */
  getAppDetails(appId: number): Promise<SteamAppDetails | null> {
    const now = Date.now();
    for (const [cachedAppId, entry] of this.recent) {
      if (entry.expiresAt <= now) {
        this.recent.delete(cachedAppId);
      }
    }
    const cached = this.recent.get(appId);
    if (cached) {
      return cached.details;
    }
    const details = this.fetchAppDetails(appId);
    this.recent.set(appId, { details, expiresAt: now + RECENT_TTL_MS });
    // A failed request isn't remembered: the next caller tries again.
    void details.catch(() => this.recent.delete(appId));
    return details;
  }

  private fetchAppDetails(appId: number): Promise<SteamAppDetails | null> {
    return this.queue.add(async () => {
      let response = await this.request(appId);
      if (response.status === 429) {
        // Over the limit anyway (another app on the same IP, a burst…):
        // the whole queue waits, then this request tries once more.
        await new Promise((resolve) =>
          setTimeout(resolve, RATE_LIMIT_PAUSE_MS),
        );
        response = await this.request(appId);
      }
      return this.parse(appId, response);
    });
  }

  private request(appId: number): Promise<Response> {
    const url = new URL('https://store.steampowered.com/api/appdetails');
    url.searchParams.set('appids', String(appId));
    url.searchParams.set('l', 'english');
    return fetch(url, { signal: AbortSignal.timeout(10_000) });
  }

  private async parse(
    appId: number,
    response: Response,
  ): Promise<SteamAppDetails | null> {
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
