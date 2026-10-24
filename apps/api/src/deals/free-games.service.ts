import { Injectable, Logger } from '@nestjs/common';
import type { FreeGamesResponse } from '@psq/shared';
import { GameStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GamerPowerApi } from '../providers/gamerpower/gamerpower-api.js';
import { normalizeTitle } from '../providers/igdb/igdb-api.js';

/**
 * Free games of the week in the official stores, from GamerPower. The
 * list is the same for everyone: fetched once a night into free_games,
 * replacing the previous one. What changes per player is whether they
 * already have the game or want it, matched by title.
 */
@Injectable()
export class FreeGamesService {
  private readonly logger = new Logger(FreeGamesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamerPower: GamerPowerApi,
  ) {}

  /** Replaces the list with today's giveaways; returns how many there are. */
  async refresh(now = new Date()): Promise<{ freeGames: number }> {
    const giveaways = await this.gamerPower.freeGames();
    await this.prisma.$transaction([
      this.prisma.freeGame.deleteMany({
        where: { id: { notIn: giveaways.map((giveaway) => giveaway.id) } },
      }),
      ...giveaways.map(({ id, ...data }) =>
        this.prisma.freeGame.upsert({
          where: { id },
          create: { id, ...data, fetchedAt: now },
          update: { ...data, fetchedAt: now },
        }),
      ),
    ]);
    this.logger.log(`Free games: ${giveaways.length}`);
    return { freeGames: giveaways.length };
  }

  async list(userId: string, now = new Date()): Promise<FreeGamesResponse> {
    const [games, library] = await Promise.all([
      this.prisma.freeGame.findMany({
        // One that ended since last night is gone already.
        where: { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        orderBy: [{ endsAt: { sort: 'asc', nulls: 'last' } }, { title: 'asc' }],
      }),
      this.prisma.userGame.findMany({
        where: { userId, hidden: false },
        select: {
          owned: true,
          status: true,
          game: { select: { title: true } },
        },
      }),
    ]);
    const owned = new Set<string>();
    const wanted = new Set<string>();
    for (const entry of library) {
      const title = normalizeTitle(entry.game.title);
      if (entry.owned) {
        owned.add(title);
      } else if (entry.status === GameStatus.WISHLIST) {
        wanted.add(title);
      }
    }
    const updatedAt = games.reduce<Date | null>(
      (latest, game) =>
        !latest || game.fetchedAt > latest ? game.fetchedAt : latest,
      null,
    );
    return {
      items: games.map((game) => {
        const title = normalizeTitle(game.title);
        return {
          id: game.id,
          title: game.title,
          worth: game.worth,
          imageUrl: game.imageUrl,
          url: game.url,
          stores: game.stores,
          endsAt: game.endsAt?.toISOString() ?? null,
          owned: owned.has(title),
          wanted: !owned.has(title) && wanted.has(title),
        };
      }),
      updatedAt: updatedAt?.toISOString() ?? null,
    };
  }
}
