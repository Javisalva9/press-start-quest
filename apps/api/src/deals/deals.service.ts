import { Injectable } from '@nestjs/common';
import type { DealPrice, DealsResponse } from '@psq/shared';
import { GameStatus, type Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { affinityByGame } from '../recommendations/queries/affinity.js';
import { dealScore } from './deal-score.js';

/** The price columns of a deal, as the API sends them. */
export function toDealPrice(deal: {
  store: string;
  price: Prisma.Decimal;
  regularPrice: Prisma.Decimal;
  cutPct: number;
  currency: string;
  url: string;
  isHistoricalLow: boolean;
  lowestPrice: Prisma.Decimal | null;
  expiresAt: Date | null;
}): DealPrice {
  return {
    store: deal.store,
    price: deal.price.toNumber(),
    regularPrice: deal.regularPrice.toNumber(),
    cutPct: deal.cutPct,
    currency: deal.currency,
    url: deal.url,
    isHistoricalLow: deal.isHistoricalLow,
    lowestPrice: deal.lowestPrice?.toNumber() ?? null,
    expiresAt: deal.expiresAt?.toISOString() ?? null,
  };
}

/**
 * The deals screen: every game of the player's wishlist that an official
 * store sells, with its price and how well it fits them. All of it at
 * once (a wishlist is a couple of hundred games at most): the web app
 * sorts and filters without asking again.
 */
@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<DealsResponse> {
    const entries = await this.prisma.userGame.findMany({
      where: {
        userId,
        owned: false,
        status: GameStatus.WISHLIST,
        hidden: false,
        game: { deal: { isNot: null } },
      },
      select: {
        id: true,
        gameId: true,
        wishlistPriority: true,
        game: {
          select: {
            title: true,
            coverUrl: true,
            heroUrl: true,
            rating: true,
            ratingCount: true,
            metacritic: true,
            deal: true,
          },
        },
      },
    });
    if (entries.length === 0) {
      return { items: [], updatedAt: null };
    }

    const gameIds = entries.map((entry) => entry.gameId);
    const [affinities, picks] = await Promise.all([
      affinityByGame(this.prisma, userId, gameIds),
      this.prisma.curatorPick.findMany({
        where: {
          gameId: { in: gameIds },
          curator: { followers: { some: { userId } } },
        },
        select: {
          gameId: true,
          curator: { select: { name: true, color: true } },
        },
        orderBy: { curator: { name: 'asc' } },
      }),
    ]);
    const affinity = new Map(affinities.map((row) => [row.gameId, row]));
    // Compared with the best fit of this list: it gets 1.
    const best = Math.max(0, ...affinities.map((row) => Number(row.raw)));
    const curators = new Map<
      string,
      Array<{ name: string; color: string | null }>
    >();
    for (const { gameId, curator } of picks) {
      curators.set(gameId, [...(curators.get(gameId) ?? []), curator]);
    }

    let updatedAt: Date | null = null;
    const items = entries.flatMap((entry) => {
      const { game } = entry;
      const deal = game.deal;
      if (!deal) {
        return [];
      }
      if (!updatedAt || deal.fetchedAt > updatedAt) {
        updatedAt = deal.fetchedAt;
      }
      const row = affinity.get(entry.gameId);
      const fit =
        best > 0 && row ? Math.min(1, Math.max(0, Number(row.raw) / best)) : 0;
      const recommendedBy = curators.get(entry.gameId) ?? [];
      return [
        {
          ...toDealPrice(deal),
          id: entry.id,
          title: game.title,
          coverUrl: game.coverUrl,
          heroUrl: game.heroUrl,
          rating: game.rating ?? game.metacritic,
          wishlistPriority: entry.wishlistPriority,
          recommendedBy,
          fit: Math.round(fit * 1000) / 1000,
          topTag:
            row?.topTag && row.topKind
              ? { name: row.topTag, kind: row.topKind }
              : null,
          score: dealScore({
            fit,
            rating: game.rating,
            ratingCount: game.ratingCount,
            metacritic: game.metacritic,
            cutPct: deal.cutPct,
            isHistoricalLow: deal.isHistoricalLow,
            recommended: recommendedBy.length > 0,
          }),
        },
      ];
    });
    items.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    return {
      items,
      updatedAt: (updatedAt as Date | null)?.toISOString() ?? null,
    };
  }
}
