import { Injectable, Logger } from '@nestjs/common';
import { GameStatus } from '../generated/prisma/client.js';
import { chunk } from '../common/chunk.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ItadApi } from '../providers/itad/itad-api.js';
import { loadOfficialStores, matchOfficialShops } from './official-stores.js';

/** Prices in euros, for Spain: the app is used in Europe. */
export const PRICE_COUNTRY = 'ES';

/** Rows written per transaction. */
const WRITE_BATCH = 50;

/** What a run did, for the nightly log. */
export interface PriceRunSummary {
  /** Games someone wants. */
  wanted: number;
  /** Of those, the ones ITAD knows (by their Steam appid). */
  onItad: number;
  /** Sold right now in an official store. */
  priced: number;
  onSale: number;
  historicalLows: number;
  /** Official stores ITAD doesn't list in Spain (or names differently). */
  storesMissing: string[];
}

/**
 * Every night, the best price of each game someone wants ("Lo quiero")
 * in the official stores, and its historical low, from IsThereAnyDeal.
 * One row per game in `deals`, replaced each time; a game no official
 * store sells loses its row.
 *
 * Games are found on ITAD by their Steam appid; the id is kept in
 * games.itadId so later nights skip the lookup. Games without an appid
 * are left out for now.
 */
@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly itad: ItadApi,
  ) {}

  get enabled(): boolean {
    return this.itad.enabled;
  }

  async refresh(now = new Date()): Promise<PriceRunSummary> {
    const games = await this.prisma.game.findMany({
      where: {
        userGames: {
          some: { owned: false, status: GameStatus.WISHLIST, hidden: false },
        },
      },
      select: { id: true, steamAppId: true, itadId: true },
    });

    const itadIds = await this.linkToItad(games);
    const shops = matchOfficialShops(
      loadOfficialStores(),
      await this.itad.shops(PRICE_COUNTRY),
    );
    if (shops.missing.length > 0) {
      this.logger.warn(
        `Official stores ITAD doesn't list in ${PRICE_COUNTRY}: ${shops.missing.join(', ')}`,
      );
    }

    const gameOf = new Map(
      [...itadIds].map(([gameId, itadId]) => [itadId, gameId]),
    );
    const prices =
      gameOf.size > 0 && shops.shopIds.length > 0
        ? await this.itad.prices(
            [...gameOf.keys()],
            shops.shopIds,
            PRICE_COUNTRY,
          )
        : [];

    const summary: PriceRunSummary = {
      wanted: games.length,
      onItad: gameOf.size,
      priced: 0,
      onSale: 0,
      historicalLows: 0,
      storesMissing: shops.missing,
    };
    const writes = [];
    const unsold: string[] = [];
    for (const { itadId, current, lowest } of prices) {
      const gameId = gameOf.get(itadId);
      if (!gameId) {
        continue;
      }
      if (!current) {
        unsold.push(gameId);
        continue;
      }
      // At or under the lowest ever: ITAD's low may be this very deal.
      const isHistoricalLow =
        current.cutPct > 0 && lowest !== null && current.price <= lowest.price;
      summary.priced += 1;
      summary.onSale += current.cutPct > 0 ? 1 : 0;
      summary.historicalLows += isHistoricalLow ? 1 : 0;
      const data = {
        store: current.shop,
        price: current.price,
        regularPrice: current.regularPrice,
        cutPct: current.cutPct,
        currency: current.currency,
        url: current.url,
        isHistoricalLow,
        lowestPrice: lowest?.price ?? null,
        lowestAt: lowest?.at ?? null,
        expiresAt: current.expiresAt,
        fetchedAt: now,
      };
      writes.push(
        this.prisma.deal.upsert({
          where: { gameId },
          create: { gameId, ...data },
          update: data,
        }),
      );
    }
    for (const batch of chunk(writes, WRITE_BATCH)) {
      await this.prisma.$transaction(batch);
    }
    if (unsold.length > 0) {
      await this.prisma.deal.deleteMany({ where: { gameId: { in: unsold } } });
    }

    this.logger.log(`Prices: ${JSON.stringify(summary)}`);
    return summary;
  }

  /**
   * The ITAD id of each game (game id → ITAD id), looking up the ones
   * that don't have it yet by their Steam appid and saving them. Two
   * games ITAD sees as one (an edition) keep the id on the first only.
   */
  private async linkToItad(
    games: Array<{
      id: string;
      steamAppId: number | null;
      itadId: string | null;
    }>,
  ): Promise<Map<string, string>> {
    const linked = new Map(
      games.flatMap((game) => (game.itadId ? [[game.id, game.itadId]] : [])),
    ) as Map<string, string>;
    const toFind = games.filter(
      (game): game is typeof game & { steamAppId: number } =>
        !game.itadId && game.steamAppId !== null,
    );
    if (toFind.length === 0) {
      return linked;
    }

    const found = await this.itad.findBySteamAppIds(
      toFind.map((game) => game.steamAppId),
    );
    const taken = new Set(
      (
        await this.prisma.game.findMany({
          where: { itadId: { in: [...found.values()] } },
          select: { itadId: true },
        })
      ).map((game) => game.itadId),
    );
    for (const game of toFind) {
      const itadId = found.get(game.steamAppId);
      if (!itadId || taken.has(itadId)) {
        continue;
      }
      taken.add(itadId);
      await this.prisma.game.update({
        where: { id: game.id },
        data: { itadId },
      });
      linked.set(game.id, itadId);
    }
    return linked;
  }
}
