import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PQueue from 'p-queue';
import { z } from 'zod';
import { chunk } from '../../common/chunk.js';
import type { Env } from '../../config/env.js';

const IGDB_URL = 'https://api.igdb.com/v4/';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
/** IGDB's id for Steam in `external_game_source`. */
const STEAM_SOURCE = 1;
/** IGDB's id for PC (Windows). */
const PC_PLATFORM = 6;
/** Most results IGDB returns per query. */
const MAX_LIMIT = 500;

const TokenSchema = z.object({
  access_token: z.string(),
  // Seconds; Twitch app tokens last around two months.
  expires_in: z.number(),
});

const ExternalGamesSchema = z.array(
  z.object({ game: z.number().int(), uid: z.string() }),
);

const Named = z.array(z.object({ name: z.string() })).optional();

const GamesSchema = z.array(
  z.object({
    id: z.number().int(),
    name: z.string(),
    slug: z.string(),
    summary: z.string().optional(),
    // Seconds since 1970.
    first_release_date: z.number().int().optional(),
    // Average of users' and critics' ratings, 0–100.
    total_rating: z.number().optional(),
    total_rating_count: z.number().int().optional(),
    cover: z.object({ image_id: z.string() }).optional(),
    genres: Named,
    themes: Named,
    game_modes: Named,
    player_perspectives: Named,
    involved_companies: z
      .array(
        z.object({
          developer: z.boolean(),
          company: z.object({ name: z.string() }),
        }),
      )
      .optional(),
  }),
);

const TimesToBeatSchema = z.array(
  z.object({
    game_id: z.number().int(),
    // Seconds.
    hastily: z.number().optional(),
    normally: z.number().optional(),
    completely: z.number().optional(),
  }),
);

const SearchSchema = z.array(
  z.object({
    id: z.number().int(),
    name: z.string(),
    first_release_date: z.number().int().optional(),
    cover: z.object({ image_id: z.string() }).optional(),
  }),
);

export interface IgdbGame {
  igdbId: number;
  title: string;
  slug: string;
  summary: string | null;
  releaseDate: Date | null;
  /** 0–100. */
  rating: number | null;
  ratingCount: number | null;
  /** 3:4 cover, 264×374. */
  coverUrl: string | null;
  developer: string | null;
  genres: string[];
  themes: string[];
  modes: string[];
  perspectives: string[];
}

/**
 * How long a game takes, in minutes, from IGDB's player submissions.
 * IGDB's names map onto the usual HowLongToBeat ones:
 * hastily = main story, normally = main + extras, completely = 100 %.
 */
export interface IgdbTimeToBeat {
  igdbId: number;
  mainMinutes: number | null;
  extraMinutes: number | null;
  completeMinutes: number | null;
}

export interface IgdbSearchResult {
  igdbId: number;
  title: string;
  releaseYear: number | null;
  coverUrl: string | null;
}

/** IGDB answered 429 even after spacing requests out. */
export class IgdbRateLimitError extends Error {}

/**
 * Client for IGDB (owned by Twitch): covers, ratings, genres and lengths.
 * Every request goes through one queue that respects IGDB's limit of
 * 4 requests per second, and uses a Twitch app token renewed on its own.
 */
@Injectable()
export class IgdbApi {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly queue = new PQueue({
    concurrency: 4,
    intervalCap: 4,
    interval: 1000,
  });
  private token: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;

  constructor(config: ConfigService<Env, true>) {
    this.clientId = config.get('IGDB_CLIENT_ID', { infer: true });
    this.clientSecret = config.get('IGDB_CLIENT_SECRET', { infer: true });
  }

  /** IGDB id of each Steam appid IGDB knows: appid → IGDB id. */
  async findBySteamAppIds(appIds: number[]): Promise<Map<number, number>> {
    const matches = new Map<number, number>();
    for (const batch of chunk(appIds, MAX_LIMIT)) {
      const uids = batch.map((appId) => `"${appId}"`).join(',');
      const rows = ExternalGamesSchema.parse(
        await this.query(
          'external_games',
          `fields game,uid; where external_game_source = ${STEAM_SOURCE} & uid = (${uids}); limit ${MAX_LIMIT};`,
        ),
      );
      for (const row of rows) {
        matches.set(Number(row.uid), row.game);
      }
    }
    return matches;
  }

  /** Details of several games, in any order. */
  async getGames(igdbIds: number[]): Promise<IgdbGame[]> {
    const games: IgdbGame[] = [];
    for (const batch of chunk(igdbIds, MAX_LIMIT)) {
      const rows = GamesSchema.parse(
        await this.query(
          'games',
          `fields name,slug,summary,first_release_date,total_rating,total_rating_count,cover.image_id,genres.name,themes.name,game_modes.name,player_perspectives.name,involved_companies.developer,involved_companies.company.name; where id = (${batch.join(',')}); limit ${MAX_LIMIT};`,
        ),
      );
      games.push(
        ...rows.map((row) => ({
          igdbId: row.id,
          title: row.name,
          slug: row.slug,
          summary: row.summary ?? null,
          releaseDate: fromUnixSeconds(row.first_release_date),
          rating:
            row.total_rating === undefined
              ? null
              : Math.round(row.total_rating * 10) / 10,
          ratingCount: row.total_rating_count ?? null,
          coverUrl: coverUrl(row.cover?.image_id),
          developer:
            row.involved_companies?.find((company) => company.developer)
              ?.company.name ?? null,
          genres: names(row.genres),
          themes: names(row.themes),
          modes: names(row.game_modes),
          perspectives: names(row.player_perspectives),
        })),
      );
    }
    return games;
  }

  /** Lengths of the games IGDB has data for (many don't). */
  async getTimesToBeat(igdbIds: number[]): Promise<IgdbTimeToBeat[]> {
    const times: IgdbTimeToBeat[] = [];
    for (const batch of chunk(igdbIds, MAX_LIMIT)) {
      const rows = TimesToBeatSchema.parse(
        await this.query(
          'game_time_to_beats',
          `fields game_id,hastily,normally,completely; where game_id = (${batch.join(',')}); limit ${MAX_LIMIT};`,
        ),
      );
      times.push(
        ...rows.map((row) => ({
          igdbId: row.game_id,
          mainMinutes: toMinutes(row.hastily),
          extraMinutes: toMinutes(row.normally),
          completeMinutes: toMinutes(row.completely),
        })),
      );
    }
    return times;
  }

  /** PC games whose name matches a search, best matches first. */
  async searchPcGames(text: string, limit = 10): Promise<IgdbSearchResult[]> {
    const rows = SearchSchema.parse(
      await this.query(
        'games',
        `search "${escapeQuery(text)}"; fields name,first_release_date,cover.image_id; where platforms = (${PC_PLATFORM}); limit ${limit};`,
      ),
    );
    return rows.map((row) => ({
      igdbId: row.id,
      title: row.name,
      releaseYear:
        fromUnixSeconds(row.first_release_date)?.getUTCFullYear() ?? null,
      coverUrl: coverUrl(row.cover?.image_id),
    }));
  }

  /**
   * IGDB id of a game found by its exact name, ignoring case, symbols and
   * punctuation ("DOOM®" = "Doom"). Null rather than a guess: a wrong
   * match would show another game's cover, rating and length.
   */
  async findByName(title: string): Promise<number | null> {
    const wanted = normalizeTitle(title);
    if (!wanted) {
      return null;
    }
    const results = await this.searchPcGames(title, 10);
    return (
      results.find((result) => normalizeTitle(result.title) === wanted)
        ?.igdbId ?? null
    );
  }

  private query(endpoint: string, body: string): Promise<unknown> {
    return this.queue.add(async () => {
      let response = await this.post(endpoint, body, await this.accessToken());
      if (response.status === 401) {
        // Token revoked or expired early: get a new one and try once more.
        this.token = null;
        response = await this.post(endpoint, body, await this.accessToken());
      }
      if (response.status === 429) {
        throw new IgdbRateLimitError('IGDB rate limit reached');
      }
      if (!response.ok) {
        throw new Error(`IGDB ${endpoint} responded with ${response.status}`);
      }
      return response.json();
    });
  }

  private post(endpoint: string, body: string, token: string) {
    return fetch(new URL(endpoint, IGDB_URL), {
      method: 'POST',
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
  }

  /** Cached Twitch app token; a single request when several need a new one. */
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - 60_000 > Date.now()) {
      return this.token.value;
    }
    this.tokenRequest ??= this.requestToken().finally(() => {
      this.tokenRequest = null;
    });
    return this.tokenRequest;
  }

  private async requestToken(): Promise<string> {
    // Credentials go in the body, not the URL: URLs end up in logs.
    const response = await fetch(new URL(TWITCH_TOKEN_URL), {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Twitch token request responded with ${response.status}`);
    }
    const token = TokenSchema.parse(await response.json());
    this.token = {
      value: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    };
    return token.access_token;
  }
}

/** Lowercase, without ™®©, accents or punctuation, single spaces. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeQuery(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function coverUrl(imageId: string | undefined): string | null {
  return imageId
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`
    : null;
}

function names(items: Array<{ name: string }> | undefined): string[] {
  return items?.map((item) => item.name) ?? [];
}

function toMinutes(seconds: number | undefined): number | null {
  return seconds ? Math.round(seconds / 60) : null;
}

function fromUnixSeconds(seconds: number | undefined): Date | null {
  return seconds ? new Date(seconds * 1000) : null;
}
