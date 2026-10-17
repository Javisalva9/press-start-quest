import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApiError, CuratorSummary } from '@psq/shared';
import { GameStatus, StatusSource } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Curators: people whose game lists the player can follow (AlexElCapso,
 * later friends). Following one labels the player's games from its list
 * and adds the rest to "Lo quiero"; unfollowing removes what it added and
 * the player hasn't touched.
 */
@Injectable()
export class CuratorsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Global creators and the player's own friends, with their numbers. */
  async list(userId: string): Promise<CuratorSummary[]> {
    const curators = await this.prisma.curator.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      select: {
        id: true,
        name: true,
        kind: true,
        color: true,
        followers: { where: { userId }, select: { userId: true } },
        picks: {
          select: {
            game: {
              select: {
                userGames: { where: { userId }, select: { owned: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return curators.map((curator) => ({
      id: curator.id,
      name: curator.name,
      kind: curator.kind,
      color: curator.color,
      games: curator.picks.length,
      owned: curator.picks.filter((pick) => pick.game.userGames[0]?.owned)
        .length,
      following: curator.followers.length > 0,
    }));
  }

  async follow(userId: string, curatorId: string): Promise<CuratorSummary> {
    await this.visible(userId, curatorId);
    await this.prisma.userCurator.upsert({
      where: { userId_curatorId: { userId, curatorId } },
      create: { userId, curatorId },
      update: {},
    });
    await this.addPicksToWishlist(userId, curatorId);
    return this.summary(userId, curatorId);
  }

  async unfollow(userId: string, curatorId: string): Promise<CuratorSummary> {
    await this.visible(userId, curatorId);
    await this.prisma.$transaction([
      this.prisma.userCurator.deleteMany({ where: { userId, curatorId } }),
      // What its list brought and is still untouched. Bought, given a
      // status, or removed by hand (hidden) stays: the player decided.
      this.prisma.userGame.deleteMany({
        where: {
          userId,
          addedByCuratorId: curatorId,
          owned: false,
          status: GameStatus.WISHLIST,
          statusSource: StatusSource.AUTO,
          hidden: false,
        },
      }),
    ]);
    return this.summary(userId, curatorId);
  }

  /**
   * Adds to "Lo quiero" the curator's games the player has no entry for.
   * Any existing entry is left alone: owned, already wished for, or
   * removed by hand (which must not come back).
   */
  async addPicksToWishlist(userId: string, curatorId: string): Promise<number> {
    const picks = await this.prisma.curatorPick.findMany({
      where: { curatorId, game: { userGames: { none: { userId } } } },
      select: { gameId: true },
    });
    if (picks.length === 0) {
      return 0;
    }
    const { count } = await this.prisma.userGame.createMany({
      data: picks.map(({ gameId }) => ({
        userId,
        gameId,
        owned: false,
        status: GameStatus.WISHLIST,
        addedByCuratorId: curatorId,
      })),
      skipDuplicates: true,
    });
    return count;
  }

  private async summary(
    userId: string,
    curatorId: string,
  ): Promise<CuratorSummary> {
    const curators = await this.list(userId);
    return curators.find((curator) => curator.id === curatorId)!;
  }

  /** A global creator, or one of the player's friends: else 404. */
  private async visible(userId: string, curatorId: string): Promise<void> {
    const curator = await this.prisma.curator.findFirst({
      where: { id: curatorId, OR: [{ userId: null }, { userId }] },
      select: { id: true },
    });
    if (!curator) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'CURATOR_NOT_FOUND',
      } satisfies ApiError);
    }
  }
}
