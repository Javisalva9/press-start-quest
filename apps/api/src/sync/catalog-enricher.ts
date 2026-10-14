import { Injectable, Logger } from '@nestjs/common';
import {
  buildGameTags,
  buildGameUpdate,
  type GameSources,
} from '../catalog/game-metadata.js';
import { GameKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  IgdbApi,
  type IgdbGame,
  type IgdbTimeToBeat,
} from '../providers/igdb/igdb-api.js';
import {
  SteamStoreApi,
  type SteamAppDetails,
} from '../providers/steam/steam-store-api.js';

/** Catalog data is refreshed once a month: it barely changes. */
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Games saved together. If a sync stops halfway, the batches already saved
 * aren't asked for again: the next sync goes on where this one stopped.
 */
export const BATCH_SIZE = 10;

interface IgdbData {
  /** IGDB game per catalog game id. */
  games: Map<string, IgdbGame>;
  timesToBeat: Map<number, IgdbTimeToBeat>;
}

interface CatalogGame {
  id: string;
  title: string;
  steamAppId: number;
  igdbId: number | null;
  ttbSource: string | null;
}

/**
 * Fills the shared catalog with Steam Store and IGDB data: what each entry
 * really is, covers, ratings, lengths and tags.
 *
 * Only games of this user's library that were never enriched, or not in
 * the last 30 days, are asked for: after the first sync this is usually
 * nothing, and the next user who owns the same game gets it for free.
 *
 * Games are saved in batches of BATCH_SIZE, each one as soon as it's ready,
 * so an interrupted sync keeps what it already did.
 */
@Injectable()
export class CatalogEnricher {
  private readonly logger = new Logger(CatalogEnricher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly store: SteamStoreApi,
    private readonly igdb: IgdbApi,
  ) {}

  /** `onProgress` receives how much is done, from 0 to 1. */
  async enrich(
    userId: string,
    onProgress: (fraction: number) => Promise<void>,
  ): Promise<{ enriched: number }> {
    const now = new Date();
    const games = await this.prisma.game.findMany({
      where: {
        steamAppId: { not: null },
        userGames: { some: { userId } },
        OR: [
          { metadataAt: null },
          { metadataAt: { lt: new Date(now.getTime() - REFRESH_AFTER_MS) } },
        ],
      },
      select: {
        id: true,
        title: true,
        steamAppId: true,
        igdbId: true,
        kind: true,
        ttbSource: true,
      },
    });

    // Entries the name already gave away (Playtests…) need nothing else.
    const skipped = games.filter((game) => game.kind !== GameKind.GAME);
    if (skipped.length > 0) {
      await this.prisma.game.updateMany({
        where: { id: { in: skipped.map((game) => game.id) } },
        data: { metadataAt: now },
      });
    }
    const candidates: CatalogGame[] = games
      .filter((game) => game.kind === GameKind.GAME)
      .map((game) => ({ ...game, steamAppId: game.steamAppId ?? 0 }));
    if (candidates.length === 0) {
      return { enriched: 0 };
    }

    // 1. Steam Store: the slow part (one request every 1.6 s). Every request
    //    is queued now, so the store client keeps its pace while batches are
    //    being saved. These promises never reject: a failure is `undefined`.
    const pending = new Map(
      candidates.map((game) => [game.id, this.fetchStoreDetails(game)]),
    );

    // Progress: the store requests are most of the time, saving the rest.
    let fetched = 0;
    let saved = 0;
    const report = () =>
      onProgress((0.85 * fetched + 0.15 * saved) / candidates.length);

    let enriched = 0;
    let igdbDown = false;
    for (const batch of chunk(candidates, BATCH_SIZE)) {
      const storeDetails = new Map<string, SteamAppDetails | null>();
      for (const game of batch) {
        const details = await pending.get(game.id);
        if (details !== undefined) {
          storeDetails.set(game.id, details);
        }
        fetched += 1;
        await report();
      }

      // 2. IGDB, for the entries that are still games once the store's type
      //    is known (a DLC doesn't need a cover or a length). If it fails
      //    once, the rest of this sync goes on without it.
      const stillGames = batch.filter((game) => {
        const store = storeDetails.get(game.id) ?? null;
        return (
          buildGameUpdate(game, { store, igdb: null, timeToBeat: null })
            .kind === GameKind.GAME
        );
      });
      let igdb: IgdbData | null = null;
      if (!igdbDown) {
        igdb = await this.fetchIgdbData(stillGames);
        igdbDown = igdb === null;
      }

      // 3. Save this batch. Games whose store request failed are left for
      //    the next sync.
      const ready = batch.filter((game) => storeDetails.has(game.id));
      await this.saveBatch(ready, storeDetails, igdb, now);
      enriched += ready.length;
      saved += batch.length;
      await report();
    }

    return { enriched };
  }

  /** Counts that describe the user's library after the sync. */
  async coverage(
    userId: string,
  ): Promise<{ notGames: number; withoutDuration: number }> {
    const [notGames, withoutDuration] = await Promise.all([
      this.prisma.userGame.count({
        where: { userId, owned: true, game: { kind: { not: GameKind.GAME } } },
      }),
      this.prisma.userGame.count({
        where: {
          userId,
          owned: true,
          game: {
            kind: GameKind.GAME,
            ttbMainMin: null,
            ttbExtraMin: null,
            ttbCompleteMin: null,
          },
        },
      }),
    ]);
    return { notGames, withoutDuration };
  }

  /** A game's store data: null if it has no store page, undefined if it failed. */
  private async fetchStoreDetails(
    game: CatalogGame,
  ): Promise<SteamAppDetails | null | undefined> {
    try {
      return await this.store.getAppDetails(game.steamAppId);
    } catch (error) {
      this.logger.warn(
        `Steam Store failed for appid ${game.steamAppId}: ${(error as Error).message}`,
      );
      return undefined;
    }
  }

  /** Saves the store and IGDB data of one batch, with its tags. */
  private async saveBatch(
    games: CatalogGame[],
    storeDetails: Map<string, SteamAppDetails | null>,
    igdb: IgdbData | null,
    now: Date,
  ): Promise<void> {
    if (games.length === 0) {
      return;
    }
    const sources = new Map<string, GameSources>(
      games.map((game) => {
        const igdbGame = igdb?.games.get(game.id) ?? null;
        return [
          game.id,
          {
            store: storeDetails.get(game.id) ?? null,
            igdb: igdbGame,
            timeToBeat: igdbGame
              ? (igdb?.timesToBeat.get(igdbGame.igdbId) ?? null)
              : null,
          },
        ];
      }),
    );
    await this.prisma.$transaction(
      games.map((game) =>
        this.prisma.game.update({
          where: { id: game.id },
          data: {
            ...buildGameUpdate(game, sources.get(game.id)!),
            // If IGDB failed, the store data is kept but the game stays due,
            // so the next sync tries IGDB again.
            metadataAt: igdb ? now : undefined,
          },
        }),
      ),
    );
    await this.saveTags(games, sources);
  }

  /**
   * IGDB data per game id. Null if IGDB failed: the sync goes on without it.
   */
  private async fetchIgdbData(games: CatalogGame[]): Promise<IgdbData | null> {
    if (games.length === 0) {
      return { games: new Map(), timesToBeat: new Map() };
    }
    try {
      // Match: by Steam appid first, then by exact name.
      const byAppId = await this.igdb.findBySteamAppIds(
        games.filter((game) => !game.igdbId).map((game) => game.steamAppId),
      );
      const igdbIdOf = new Map<string, number>();
      await Promise.all(
        games.map(async (game) => {
          const igdbId =
            game.igdbId ??
            byAppId.get(game.steamAppId) ??
            (await this.igdb.findByName(game.title));
          if (igdbId) {
            igdbIdOf.set(game.id, igdbId);
          }
        }),
      );

      // An IGDB id is unique in the catalog: if another entry already has
      // it (two Steam apps of the same game), this one stays unmatched.
      const taken = await this.prisma.game.findMany({
        where: {
          igdbId: { in: [...igdbIdOf.values()] },
          id: { notIn: games.map((game) => game.id) },
        },
        select: { igdbId: true },
      });
      const takenIds = new Set(taken.map((game) => game.igdbId));
      const seen = new Set<number>();
      for (const [gameId, igdbId] of igdbIdOf) {
        if (takenIds.has(igdbId) || seen.has(igdbId)) {
          igdbIdOf.delete(gameId);
        }
        seen.add(igdbId);
      }

      const ids = [...new Set(igdbIdOf.values())];
      const [details, times] = await Promise.all([
        this.igdb.getGames(ids),
        this.igdb.getTimesToBeat(ids),
      ]);
      const detailsById = new Map(details.map((game) => [game.igdbId, game]));
      const gamesById = new Map<string, IgdbGame>();
      for (const [gameId, igdbId] of igdbIdOf) {
        const game = detailsById.get(igdbId);
        if (game) {
          gamesById.set(gameId, game);
        }
      }
      return {
        games: gamesById,
        timesToBeat: new Map(times.map((time) => [time.igdbId, time])),
      };
    } catch (error) {
      this.logger.warn(
        `IGDB failed, continuing without it: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /** Replaces the tags of the enriched games with the fresh ones. */
  private async saveTags(
    games: CatalogGame[],
    sources: Map<string, GameSources>,
  ): Promise<void> {
    const tagsByGame = new Map(
      games.map((game) => [game.id, buildGameTags(sources.get(game.id)!)]),
    );
    const allTags = [...tagsByGame.values()].flat();
    if (allTags.length > 0) {
      await this.prisma.tag.createMany({ data: allTags, skipDuplicates: true });
    }
    const tags = await this.prisma.tag.findMany({
      where: { name: { in: [...new Set(allTags.map((tag) => tag.name))] } },
      select: { id: true, name: true, kind: true },
    });
    const tagId = new Map(
      tags.map((tag) => [`${tag.kind}:${tag.name}`, tag.id]),
    );

    await this.prisma.$transaction([
      this.prisma.gameTag.deleteMany({
        where: { gameId: { in: games.map((game) => game.id) } },
      }),
      this.prisma.gameTag.createMany({
        data: [...tagsByGame].flatMap(([gameId, gameTags]) =>
          gameTags.flatMap((tag) => {
            const id = tagId.get(`${tag.kind}:${tag.name}`);
            return id ? [{ gameId, tagId: id }] : [];
          }),
        ),
        skipDuplicates: true,
      }),
    ]);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
