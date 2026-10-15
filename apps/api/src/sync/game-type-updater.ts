import { Injectable, Logger } from '@nestjs/common';
import { classifyGameType } from '../catalog/game-type.js';
import { GameKind, GameType, TagKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Classifies the games of a user's library as completable, endless or
 * sandbox. It only reads what the catalog already has (tags and story
 * length), so it runs on every sync at almost no cost, and games enriched
 * before the classifier existed get their type without asking IGDB again.
 *
 * The type is the catalog's, shared by every player; a player's own
 * correction lives in user_games.typeOverride and always wins.
 */
@Injectable()
export class GameTypeUpdater {
  private readonly logger = new Logger(GameTypeUpdater.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Returns how many games changed type. */
  async update(userId: string): Promise<number> {
    const games = await this.prisma.game.findMany({
      where: { kind: GameKind.GAME, userGames: { some: { userId } } },
      select: {
        id: true,
        gameType: true,
        ttbMainMin: true,
        tags: { select: { tag: { select: { name: true, kind: true } } } },
      },
    });

    // Grouped by new type: one UPDATE per type instead of one per game.
    const changes = new Map<GameType, string[]>();
    for (const game of games) {
      const names = (kind: TagKind) =>
        game.tags
          .filter(({ tag }) => tag.kind === kind)
          .map(({ tag }) => tag.name);
      const { type } = classifyGameType({
        modes: names(TagKind.MODE),
        genres: names(TagKind.GENRE),
        themes: names(TagKind.THEME),
        storeCategories: names(TagKind.STORE_CATEGORY),
        ttbMainMin: game.ttbMainMin,
      });
      if (type !== game.gameType) {
        changes.set(type, [...(changes.get(type) ?? []), game.id]);
      }
    }
    if (changes.size === 0) {
      return 0;
    }

    await this.prisma.$transaction(
      [...changes].map(([gameType, ids]) =>
        this.prisma.game.updateMany({
          where: { id: { in: ids } },
          data: { gameType },
        }),
      ),
    );
    const changed = [...changes.values()].reduce(
      (total, ids) => total + ids.length,
      0,
    );
    this.logger.log(
      `${changed} game type(s) changed: ${[...changes]
        .map(([type, ids]) => `${ids.length} ${type}`)
        .join(', ')}`,
    );
    return changed;
  }
}
