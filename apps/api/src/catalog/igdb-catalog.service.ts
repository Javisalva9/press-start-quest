import { Injectable } from '@nestjs/common';
import { type GameType, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IgdbApi } from '../providers/igdb/igdb-api.js';
import { chunk } from '../common/chunk.js';
import { buildGameTags, buildGameUpdate } from './game-metadata.js';
import { saveGameTags } from './game-tags.js';
import { classifyGameType } from './game-type.js';
import { igdbGameSlug, steamGameSlug } from './slug.js';

/** IGDB didn't answer: callers decide what that means for them. */
export class IgdbUnavailableError extends Error {}

export interface CatalogEntry {
  id: string;
  gameType: GameType;
}

/** IGDB ids per request: well under IGDB's 500 results per query. */
const BATCH = 100;

/**
 * Catalog games for IGDB ids, created from IGDB when missing. Used by the
 * games added by hand (one) and by curators' lists (dozens at once).
 *
 * If IGDB knows a game's Steam page, the game gets that appid, so it's the
 * same game when Steam brings it later (bought, or in someone else's
 * library) instead of a duplicate. A game Steam already brought gets its
 * IGDB id instead.
 */
@Injectable()
export class IgdbCatalog {
  constructor(
    private readonly prisma: PrismaService,
    private readonly igdb: IgdbApi,
  ) {}

  /** IGDB id → catalog game. Ids IGDB doesn't know are left out. */
  async ensure(igdbIds: number[]): Promise<Map<number, CatalogEntry>> {
    const ids = [...new Set(igdbIds)];
    const found = new Map<number, CatalogEntry>();
    const known = await this.prisma.game.findMany({
      where: { igdbId: { in: ids } },
      select: { id: true, gameType: true, igdbId: true },
    });
    for (const game of known) {
      found.set(game.igdbId!, { id: game.id, gameType: game.gameType });
    }
    const missing = ids.filter((id) => !found.has(id));
    for (const batch of chunk(missing, BATCH)) {
      await this.create(batch, found);
    }
    return found;
  }

  private async create(
    igdbIds: number[],
    found: Map<number, CatalogEntry>,
  ): Promise<void> {
    let details, steamAppIds, timesToBeat;
    try {
      [details, steamAppIds, timesToBeat] = await Promise.all([
        this.igdb.getGames(igdbIds),
        this.igdb.findSteamAppIds(igdbIds),
        this.igdb.getTimesToBeat(igdbIds),
      ]);
    } catch (error) {
      throw new IgdbUnavailableError('IGDB did not answer', { cause: error });
    }
    const timeToBeatOf = new Map(timesToBeat.map((ttb) => [ttb.igdbId, ttb]));

    // Already in the catalog from someone's Steam library.
    const fromSteam = await this.prisma.game.findMany({
      where: { steamAppId: { in: [...steamAppIds.values()] } },
      select: { id: true, gameType: true, igdbId: true, steamAppId: true },
    });
    const bySteamAppId = new Map(
      fromSteam.map((game) => [game.steamAppId, game]),
    );

    const created: Array<[string, ReturnType<typeof buildGameTags>]> = [];
    for (const igdb of details) {
      const steamAppId = steamAppIds.get(igdb.igdbId) ?? null;
      const steamGame =
        steamAppId === null ? undefined : bySteamAppId.get(steamAppId);
      if (steamGame) {
        // It gets its IGDB id now, so searches find it at once.
        if (steamGame.igdbId === null) {
          await this.prisma.game.update({
            where: { id: steamGame.id },
            data: { igdbId: igdb.igdbId },
          });
        }
        found.set(igdb.igdbId, {
          id: steamGame.id,
          gameType: steamGame.gameType,
        });
        continue;
      }

      const sources = {
        store: null,
        igdb,
        timeToBeat: timeToBeatOf.get(igdb.igdbId) ?? null,
      };
      const update = buildGameUpdate(
        { title: igdb.title, ttbSource: null },
        sources,
      );
      const { type } = classifyGameType({
        modes: igdb.modes,
        genres: igdb.genres,
        themes: igdb.themes,
        storeCategories: [],
        ttbMainMin: update.ttbMainMin ?? null,
      });
      try {
        const game = await this.prisma.game.create({
          data: {
            ...update,
            title: igdb.title,
            slug:
              steamAppId === null
                ? igdbGameSlug(igdb.title, igdb.igdbId)
                : steamGameSlug(igdb.title, steamAppId),
            igdbId: igdb.igdbId,
            steamAppId,
            gameType: type,
            // With a Steam page, the next sync adds the store's data
            // (header image, categories); without one, IGDB is all there is.
            metadataAt: steamAppId === null ? new Date() : null,
          },
          select: { id: true, gameType: true },
        });
        found.set(igdb.igdbId, game);
        created.push([game.id, buildGameTags(sources)]);
      } catch (error) {
        // Someone added the same game a moment ago.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const game = await this.prisma.game.findUniqueOrThrow({
            where: { igdbId: igdb.igdbId },
            select: { id: true, gameType: true },
          });
          found.set(igdb.igdbId, game);
          continue;
        }
        throw error;
      }
    }
    await saveGameTags(this.prisma, created);
  }
}
